"""Per-file registry for agent workflows (agent/workflows/{id}.json)."""

from __future__ import annotations

from sqlmodel import select

from app.agent_workflows.models import AgentWorkflowRow
from app.persistence.sqlite_db import get_session


class AgentWorkflowRegistry:
    """DB-backed registry for agent workflows."""

    @classmethod
    def list_all(cls) -> list[AgentWorkflowRow]:
        with get_session() as session:
            return list(session.exec(select(AgentWorkflowRow)))

    @classmethod
    def get_by_id(cls, wf_id: str) -> AgentWorkflowRow | None:
        with get_session() as session:
            return session.get(AgentWorkflowRow, wf_id)

    @classmethod
    def save(cls, row: AgentWorkflowRow) -> None:
        with get_session() as session:
            session.merge(row)
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
