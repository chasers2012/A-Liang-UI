from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from workspace import workspace_path

from app.scheduler.controller import enqueue_oneoff_job
from app.scheduler.handlers import register_task_handler
from app.scheduler.schemas import SchedulerJobPublic

from .config import (
    KnowledgeSettings,
    get_knowledge_settings,
)
from .models import KnowledgeChunkRow, KnowledgeDocumentRow
from .parser import extract_chunks_from_path, extract_chunks_from_text
from .rag import RetrievalResult, VectorStoreAdapter
from .schemas import (
    KnowledgeDocumentCreateRequest,
    KnowledgeDocumentPublic,
    KnowledgeSearchHit,
)
from .store import KnowledgeStore

_KNOWLEDGE_INDEX_TASK_TYPE = "knowledge.index"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_settings() -> KnowledgeSettings:
    return get_knowledge_settings()


def _adapter() -> VectorStoreAdapter:
    return VectorStoreAdapter(get_knowledge_settings())


def _to_public(row: KnowledgeDocumentRow) -> KnowledgeDocumentPublic:
    return KnowledgeDocumentPublic(
        id=row.id,
        name=row.name,
        status=row.status,
        error=row.error,
        metadata=dict(row.meta or {}),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_documents() -> list[KnowledgeDocumentPublic]:
    return [_to_public(row) for row in KnowledgeStore.list_documents()]


def get_document(document_id: str) -> KnowledgeDocumentPublic | None:
    row = KnowledgeStore.get_document(document_id)
    if row is None:
        return None
    return _to_public(row)


def create_document(body: KnowledgeDocumentCreateRequest) -> KnowledgeDocumentPublic:
    now = _utcnow()
    metadata = dict(body.metadata or {})

    row = KnowledgeDocumentRow(
        id=str(uuid4()),
        name=body.name,
        source_path=body.uploaded_path,
        status="pending",
        error=None,
        meta=metadata,
        created_at=now,
        updated_at=now,
    )
    created = KnowledgeStore.add_document(row)
    enqueue_index_document(created.id, uploaded_path=body.uploaded_path, content=body.content)
    return _to_public(created)


def enqueue_index_document(
    document_id: str,
    *,
    content: str | None = None,
    uploaded_path: str | None = None,
) -> SchedulerJobPublic:
    payload = {"document_id": document_id}
    if content is not None:
        payload["content"] = content
    if uploaded_path is not None:
        payload["uploaded_path"] = uploaded_path
    return enqueue_oneoff_job(
        task_type=_KNOWLEDGE_INDEX_TASK_TYPE,
        trigger_type="manual",
        payload=payload,
        dedupe_key=f"knowledge:{document_id}:index",
    )


def delete_document(document_id: str) -> bool:
    chunk_ids = [row.id for row in KnowledgeStore.list_chunks_by_document(document_id)]
    _adapter().delete_document(chunk_ids=chunk_ids)
    return KnowledgeStore.delete_document(document_id)


def _mark_document_status(document_id: str, *, status: str, error: str | None = None) -> None:
    now = _utcnow()

    def _apply(row: KnowledgeDocumentRow) -> None:
        row.status = status
        row.error = error
        row.updated_at = now

    KnowledgeStore.update_document(document_id, _apply)


def index_document(
    document_id: str,
    *,
    content: str | None = None,
    uploaded_path: str | None = None,
) -> None:
    row = KnowledgeStore.get_document(document_id)
    if row is None:
        raise ValueError("文档不存在")
    raw_content = (content or "").strip()
    chunks: list[str] | None = None
    if uploaded_path:
        file_path = workspace_path(uploaded_path)
        chunks, _ = extract_chunks_from_path(Path(file_path))
    elif raw_content:
        chunks, _ = extract_chunks_from_text(raw_content, filename=row.name)
    else:
        raise ValueError("文档内容为空，无法建立索引")

    try:
        settings = get_settings()
        adapter = VectorStoreAdapter(settings)
        chunk_ids = [str(uuid4()) for _ in chunks]
        docs = adapter.upsert_chunks(
            document_id=document_id,
            chunks=chunks,
            chunk_ids=chunk_ids,
            base_metadata={"document_name": row.name},
        )
        now = _utcnow()
        db_chunks = [
            KnowledgeChunkRow(
                id=chunk_id,
                document_id=document_id,
                chunk_index=int(doc.metadata.get("chunk_index", idx)),
                content=doc.page_content,
                meta=dict(doc.metadata),
                created_at=now,
            )
            for idx, (chunk_id, doc) in enumerate(zip(chunk_ids, docs, strict=False))
        ]
        KnowledgeStore.add_document_chunks(db_chunks)
        _mark_document_status(document_id, status="indexed", error=None)
    except Exception as exc:
        _mark_document_status(document_id, status="failed", error=str(exc))
        raise


def search_knowledge(query: str) -> list[KnowledgeSearchHit]:
    settings = get_settings()
    rows = {row.id: row for row in KnowledgeStore.list_documents()}
    retrievals = _adapter().retrieve(
        query=query,
        top_k=int(settings.get("top_k", 4)),
        threshold=float(settings.get("threshold", 0.2)),
        document_ids=None,
    )
    return [_retrieval_to_hit(item, rows) for item in retrievals]


def _retrieval_to_hit(
    item: RetrievalResult,
    docs_by_id: dict[str, KnowledgeDocumentRow],
) -> KnowledgeSearchHit:
    doc = docs_by_id.get(item.document_id)
    return KnowledgeSearchHit(
        document_name=(doc.name if doc else item.metadata.get("document_name", "")),
        content=item.content,
    )


def _knowledge_index_handler(payload: dict[str, object]) -> dict[str, object]:
    document_id = str(payload.get("document_id", "")).strip()
    if not document_id:
        raise ValueError("knowledge.index 任务需要 document_id")
    content = payload.get("content")
    content_text = None if content is None else str(content)
    uploaded_path = payload.get("uploaded_path")
    uploaded_path_text = None if uploaded_path is None else str(uploaded_path)
    index_document(document_id, content=content_text, uploaded_path=uploaded_path_text)
    return {"result": "success"}


register_task_handler(_KNOWLEDGE_INDEX_TASK_TYPE, _knowledge_index_handler)
