from __future__ import annotations

from typing import ClassVar

from sqlmodel import select

from app.persistence.models import WorkflowNodeVisibilityRow
from app.persistence.sqlite_db import create_db_and_tables, get_session


class WorkflowDomainNodesRegistry:
    """Registry for managing node visibility within each domain.

    Persistence model stores hidden node ids per domain.
    """

    _db_ready: ClassVar[bool] = False

    @classmethod
    def _ensure_db_ready(cls) -> None:
        if cls._db_ready:
            return
        create_db_and_tables()
        cls._db_ready = True

    @staticmethod
    def _normalize_domain(domain: str) -> str:
        value = domain.strip()
        if not value:
            raise ValueError("domain must be non-empty")
        return value

    @staticmethod
    def _sanitize_ids(node_ids: list[str] | set[str] | tuple[str, ...]) -> list[str]:
        cleaned = {node_id.strip() for node_id in node_ids if node_id and node_id.strip()}
        return sorted(cleaned)

    @classmethod
    def set_hidden_node_ids(
        cls,
        domain: str,
        hidden_node_ids: list[str] | set[str] | tuple[str, ...],
    ) -> None:
        cls._ensure_db_ready()
        normalized_domain = cls._normalize_domain(domain)
        cleaned_ids = cls._sanitize_ids(hidden_node_ids)
        with get_session() as session:
            session.merge(
                WorkflowNodeVisibilityRow(
                    domain=normalized_domain,
                    hidden_node_ids=cleaned_ids,
                )
            )
            session.commit()

    @classmethod
    def delete_domain_visibility(cls, domain: str) -> None:
        cls._ensure_db_ready()
        normalized_domain = cls._normalize_domain(domain)
        with get_session() as session:
            row = session.get(WorkflowNodeVisibilityRow, normalized_domain)
            if row is None:
                return
            session.delete(row)
            session.commit()

    @classmethod
    def list_domains(cls) -> list[str]:
        cls._ensure_db_ready()
        with get_session() as session:
            rows = list(session.exec(select(WorkflowNodeVisibilityRow.domain)))
        return sorted(rows)

    @classmethod
    def get_hidden_node_ids(cls, domain: str) -> set[str] | None:
        cls._ensure_db_ready()
        normalized_domain = cls._normalize_domain(domain)
        with get_session() as session:
            row = session.get(WorkflowNodeVisibilityRow, normalized_domain)
            if row is not None:
                return set(row.hidden_node_ids or [])
            return None

    @classmethod
    def is_node_visible(cls, domain: str, node_id: str) -> bool:
        hidden_ids = cls.get_hidden_node_ids(domain)
        if hidden_ids is None:
            return True
        return node_id not in hidden_ids

    @classmethod
    def filter_visible_node_ids(cls, domain: str, node_ids: list[str]) -> list[str]:
        return [node_id for node_id in node_ids if cls.is_node_visible(domain, node_id)]
