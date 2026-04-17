from __future__ import annotations

from contextlib import suppress
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from app.chat.schemas import AssistantBlockPublic, ChatMessageIn
from app.config import controller as config_controller
from app.config import register_config_spec
from app.config.schema import ConfigModuleSpec
from app.knowledge.models import KnowledgeChunkRow, KnowledgeDocumentRow, KnowledgeIndexMetaRow
from app.knowledge.rag import RetrievalResult, VectorStoreAdapter, build_chat_context
from app.knowledge.schemas import (
    KnowledgeDocumentCreateRequest,
    KnowledgeDocumentPublic,
    KnowledgeReindexResponse,
    KnowledgeSearchHit,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeSettings,
)
from app.knowledge.store import KnowledgeStore
from app.scheduler.controller import enqueue_oneoff_job
from app.scheduler.handlers import register_task_handler

_KNOWLEDGE_CONFIG_MODULE = "knowledge_rag"
_KNOWLEDGE_INDEX_TASK_TYPE = "knowledge.index"


@dataclass(frozen=True)
class ChatKnowledgeContext:
    message: ChatMessageIn | None
    hits: list[KnowledgeSearchHit]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _register_settings_module() -> None:
    defaults = KnowledgeSettings().model_dump(mode="json")
    rjsf_schema, rjsf_ui_schema = KnowledgeSettings.rjsf_schema_and_ui_schema()
    spec = ConfigModuleSpec(
        key=_KNOWLEDGE_CONFIG_MODULE,
        title="知识库检索",
        description="配置 Chat RAG 检索参数。",
        filename="agent/knowledge.json",
        default_values=defaults,
        json_schema=rjsf_schema,
        ui_schema=rjsf_ui_schema,
    )
    with suppress(ValueError):
        register_config_spec(spec)


def get_settings() -> KnowledgeSettings:
    values = config_controller.get_module_config(_KNOWLEDGE_CONFIG_MODULE)
    return KnowledgeSettings.model_validate(values)


def put_settings(body: KnowledgeSettings) -> KnowledgeSettings:
    values = config_controller.put_module_config(
        _KNOWLEDGE_CONFIG_MODULE,
        body.model_dump(mode="json", exclude_none=False),
    )
    return KnowledgeSettings.model_validate(values)


def _adapter() -> VectorStoreAdapter:
    return VectorStoreAdapter(get_settings())


def _to_public(row: KnowledgeDocumentRow) -> KnowledgeDocumentPublic:
    return KnowledgeDocumentPublic(
        id=row.id,
        name=row.name,
        source_path=row.source_path,
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
    row = KnowledgeDocumentRow(
        id=str(uuid4()),
        name=body.name,
        source_path=body.source_path,
        status="pending",
        error=None,
        meta=dict(body.metadata or {}),
        created_at=now,
        updated_at=now,
    )
    created = KnowledgeStore.add_document(row)
    if body.auto_index:
        enqueue_index_document(created.id, content=body.content)
        refreshed = KnowledgeStore.get_document(created.id)
        if refreshed is not None:
            return _to_public(refreshed)
    return _to_public(created)


def enqueue_index_document(
    document_id: str, *, content: str | None = None
) -> KnowledgeReindexResponse:
    payload = {"document_id": document_id}
    if content is not None:
        payload["content"] = content
    job = enqueue_oneoff_job(
        task_type=_KNOWLEDGE_INDEX_TASK_TYPE,
        trigger_type="manual",
        payload=payload,
        dedupe_key=f"knowledge:{document_id}:index",
    )
    return KnowledgeReindexResponse(document_id=document_id, indexed_chunks=0, status=job.status)


def delete_document(document_id: str) -> bool:
    chunk_count = len(KnowledgeStore.list_chunks_by_document(document_id))
    _adapter().delete_document(document_id, chunk_count=chunk_count)
    return KnowledgeStore.delete_document(document_id)


def _mark_document_status(document_id: str, *, status: str, error: str | None = None) -> None:
    now = _utcnow()

    def _apply(row: KnowledgeDocumentRow) -> None:
        row.status = status
        row.error = error
        row.updated_at = now

    KnowledgeStore.update_document(document_id, _apply)


def reindex_document(document_id: str, *, content: str | None = None) -> KnowledgeReindexResponse:
    row = KnowledgeStore.get_document(document_id)
    if row is None:
        raise ValueError("文档不存在")
    raw_content = (content or "").strip()
    if not raw_content:
        raw_content = str((row.meta or {}).get("content", "")).strip()
    if not raw_content:
        raise ValueError("文档内容为空，无法建立索引")

    try:
        settings = get_settings()
        adapter = VectorStoreAdapter(settings)
        chunks = adapter.split_text(raw_content)
        docs = adapter.upsert_chunks(
            document_id=document_id,
            chunks=chunks,
            base_metadata={"document_name": row.name},
        )
        now = _utcnow()
        db_chunks = [
            KnowledgeChunkRow(
                id=str(uuid4()),
                document_id=document_id,
                chunk_index=int(doc.metadata.get("chunk_index", idx)),
                content=doc.page_content,
                meta=dict(doc.metadata),
                created_at=now,
            )
            for idx, doc in enumerate(docs)
        ]
        count = KnowledgeStore.replace_document_chunks(document_id, db_chunks)
        KnowledgeStore.upsert_index_meta(
            KnowledgeIndexMetaRow(
                id=f"idx:{document_id}",
                document_id=document_id,
                chunk_count=count,
                embed_model=f"{settings.embedding_provider}:{settings.embedding_model}",
                vector_store=settings.vector_store,
                updated_at=now,
            )
        )
        _mark_document_status(document_id, status="indexed", error=None)
        return KnowledgeReindexResponse(document_id=document_id, indexed_chunks=count, status="ok")
    except Exception as exc:
        _mark_document_status(document_id, status="failed", error=str(exc))
        raise


def search_knowledge(body: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    settings = get_settings()
    top_k = body.top_k or settings.top_k
    threshold = settings.threshold if body.threshold is None else body.threshold
    rows = {row.id: row for row in KnowledgeStore.list_documents()}
    retrievals = _adapter().retrieve(
        query=body.query,
        top_k=top_k,
        threshold=threshold,
        document_ids=body.document_ids,
    )
    hits: list[KnowledgeSearchHit] = []
    for item in retrievals:
        doc = rows.get(item.document_id)
        hits.append(
            KnowledgeSearchHit(
                chunk_id=item.chunk_id,
                document_id=item.document_id,
                document_name=(doc.name if doc else item.metadata.get("document_name", "")),
                content=item.content,
                score=item.score,
                metadata=item.metadata,
            )
        )
    return KnowledgeSearchResponse(hits=hits)


def retrieve_for_chat(query: str) -> ChatKnowledgeContext:
    settings = get_settings()
    if not settings.enabled:
        return ChatKnowledgeContext(message=None, hits=[])
    if not query.strip():
        return ChatKnowledgeContext(message=None, hits=[])

    retrievals = _adapter().retrieve(
        query=query,
        top_k=settings.top_k,
        threshold=settings.threshold,
    )
    if not retrievals:
        return ChatKnowledgeContext(message=None, hits=[])

    docs_by_id = {row.id: row for row in KnowledgeStore.list_documents()}
    hits = [_retrieval_to_hit(item, docs_by_id) for item in retrievals]
    context_text = build_chat_context(query, [_hit_to_retrieval(hit) for hit in hits])
    if not context_text:
        return ChatKnowledgeContext(message=None, hits=hits)
    system_message = ChatMessageIn(
        role="system",
        blocks=[AssistantBlockPublic(kind="text", content=context_text)],
    )
    return ChatKnowledgeContext(message=system_message, hits=hits)


def _retrieval_to_hit(
    item: RetrievalResult,
    docs_by_id: dict[str, KnowledgeDocumentRow],
) -> KnowledgeSearchHit:
    doc = docs_by_id.get(item.document_id)
    return KnowledgeSearchHit(
        chunk_id=item.chunk_id,
        document_id=item.document_id,
        document_name=(doc.name if doc else item.metadata.get("document_name", "")),
        content=item.content,
        score=item.score,
        metadata=item.metadata,
    )


def _hit_to_retrieval(hit: KnowledgeSearchHit) -> RetrievalResult:
    return RetrievalResult(
        chunk_id=hit.chunk_id,
        document_id=hit.document_id,
        content=hit.content,
        score=hit.score,
        metadata=hit.metadata,
    )


def _knowledge_index_handler(payload: dict[str, object]) -> dict[str, object]:
    from app.knowledge.controller import reindex_document

    document_id = str(payload.get("document_id", "")).strip()
    if not document_id:
        raise ValueError("knowledge.index 任务需要 document_id")
    content = payload.get("content")
    content_text = None if content is None else str(content)
    result = reindex_document(document_id, content=content_text)
    return result.model_dump(mode="json")


register_task_handler("knowledge.index", _knowledge_index_handler)


_register_settings_module()
