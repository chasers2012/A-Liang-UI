from __future__ import annotations

from pathlib import Path

from fastapi import (  # type: ignore[import-not-found]
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel, Field

from app.http_errors import http_bad_request
from app.knowledge import controller
from app.knowledge.parser import extract_text
from app.knowledge.schemas import (
    KnowledgeDocumentCreateRequest,
    KnowledgeDocumentPublic,
    KnowledgeSearchHit,
    KnowledgeSearchRequest,
    KnowledgeSettings,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class KnowledgeSearchResponse(BaseModel):
    hits: list[KnowledgeSearchHit] = Field(default_factory=list)


class KnowledgeReindexResponse(BaseModel):
    document_id: str
    indexed_chunks: int = 0
    status: str = "queued"


@router.post("/documents", response_model=KnowledgeDocumentPublic)
def create_knowledge_document(body: KnowledgeDocumentCreateRequest) -> KnowledgeDocumentPublic:
    try:
        return controller.create_document(body)
    except ValueError as exc:
        http_bad_request(exc)


@router.post("/documents/upload", response_model=KnowledgeDocumentPublic)
async def upload_knowledge_document(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    source_path: str | None = Form(default=None),
    auto_index: bool = Form(default=True),
) -> KnowledgeDocumentPublic:
    try:
        content, filename = await extract_text(file)
        body = KnowledgeDocumentCreateRequest(
            name=(name or Path(filename).stem or filename or "未命名文档"),
            content=content,
            source_path=source_path or filename,
            auto_index=auto_index,
        )
        return controller.create_document(body)
    except ValueError as exc:
        http_bad_request(exc)


@router.get("/documents", response_model=list[KnowledgeDocumentPublic])
def list_knowledge_documents() -> list[KnowledgeDocumentPublic]:
    return controller.list_documents()


@router.get("/documents/{document_id}", response_model=KnowledgeDocumentPublic)
def get_knowledge_document(document_id: str) -> KnowledgeDocumentPublic:
    doc = controller.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    return doc


@router.delete("/documents/{document_id}", status_code=204)
def delete_knowledge_document(document_id: str) -> None:
    if not controller.delete_document(document_id):
        raise HTTPException(status_code=404, detail="文档不存在")


@router.post("/documents/{document_id}/reindex", response_model=KnowledgeReindexResponse)
def reindex_knowledge_document(document_id: str) -> KnowledgeReindexResponse:
    try:
        job = controller.enqueue_index_document(document_id)
        return KnowledgeReindexResponse(
            document_id=document_id, indexed_chunks=0, status=job.status
        )
    except ValueError as exc:
        http_bad_request(exc)


@router.post("/search", response_model=KnowledgeSearchResponse)
def search_knowledge(body: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    hits = controller.search_knowledge(body)
    return KnowledgeSearchResponse(hits=hits)


@router.get("/settings", response_model=KnowledgeSettings)
def get_knowledge_settings() -> KnowledgeSettings:
    return controller.get_settings()


@router.put("/settings", response_model=KnowledgeSettings)
def put_knowledge_settings(body: KnowledgeSettings) -> KnowledgeSettings:
    try:
        return controller.put_settings(body)
    except ValueError as exc:
        http_bad_request(exc)
