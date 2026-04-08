"""Per-file registry for agent workflows (agent/workflows/{id}.json)."""

from __future__ import annotations

from sqlmodel import select

from app.agent_workflows.schemas import AgentWorkflowRecord
from app.persistence.models import AgentWorkflowRow
from app.persistence.sqlite_db import get_session


class AgentWorkflowRegistry:
    """DB-backed registry for agent workflows."""

    @staticmethod
    def _row_to_record(row: AgentWorkflowRow) -> AgentWorkflowRecord:
        return AgentWorkflowRecord(
            id=row.id,
            name=row.name,
            description=row.description,
            graph=row.graph,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _record_to_row(rec: AgentWorkflowRecord) -> AgentWorkflowRow:
        return AgentWorkflowRow(
            id=rec.id,
            name=rec.name,
            description=rec.description,
            graph=rec.graph,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
        )

    @classmethod
    def list_all(cls) -> list[AgentWorkflowRecord]:
        with get_session() as session:
            rows = list(session.exec(select(AgentWorkflowRow)))
        return [cls._row_to_record(r) for r in rows]

    @classmethod
    def get_by_id(cls, wf_id: str) -> AgentWorkflowRecord | None:
        with get_session() as session:
            row = session.get(AgentWorkflowRow, wf_id)
            return cls._row_to_record(row) if row is not None else None

    @classmethod
    def save(cls, rec: AgentWorkflowRecord) -> None:
        with get_session() as session:
            session.merge(cls._record_to_row(rec))
            session.commit()

    @classmethod
    def delete_by_id(cls, wf_id: str) -> bool:
        with get_session() as session:
            row = session.get(AgentWorkflowRow, wf_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
