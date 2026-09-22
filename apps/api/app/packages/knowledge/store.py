from __future__ import annotations

from collections.abc import Callable

from sqlmodel import col, delete, select

from app.infra.persistence.sqlite_db import get_session

from .models import KnowledgeChunkRow, KnowledgeDocumentRow


class KnowledgeStore:
    @classmethod
    def list_documents(cls) -> list[KnowledgeDocumentRow]:
        with get_session() as session:
            return list(
                session.exec(
                    select(KnowledgeDocumentRow).order_by(col(KnowledgeDocumentRow.created_at))
                )
            )

    @classmethod
    def get_document(cls, document_id: str) -> KnowledgeDocumentRow | None:
        with get_session() as session:
            return session.get(KnowledgeDocumentRow, document_id)

    @classmethod
    def add_document(cls, row: KnowledgeDocumentRow) -> KnowledgeDocumentRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def update_document(
        cls,
        document_id: str,
        apply: Callable[[KnowledgeDocumentRow], None],
    ) -> KnowledgeDocumentRow | None:
        with get_session() as session:
            row = session.get(KnowledgeDocumentRow, document_id)
            if row is None:
                return None
            apply(row)
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def delete_document(cls, document_id: str) -> bool:
        with get_session() as session:
            row = session.get(KnowledgeDocumentRow, document_id)
            if row is None:
                return False
            session.exec(
                delete(KnowledgeChunkRow).where(KnowledgeChunkRow.document_id == document_id)
            )
            session.delete(row)
            session.commit()
            return True

    @classmethod
    def add_document_chunks(
        cls,
        chunks: list[KnowledgeChunkRow],
    ) -> int:
        if not chunks:
            return 0
        with get_session() as session:
            for chunk in chunks:
                session.add(chunk)
            session.commit()
            return len(chunks)

    @classmethod
    def list_chunks_by_document(cls, document_id: str) -> list[KnowledgeChunkRow]:
        with get_session() as session:
            stmt = (
                select(KnowledgeChunkRow)
                .where(KnowledgeChunkRow.document_id == document_id)
                .order_by(col(KnowledgeChunkRow.chunk_index))
            )
            return list(session.exec(stmt))
