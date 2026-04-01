"""Per-file registry for agent workflows (agent/workflows/{id}.json)."""

from __future__ import annotations

import json
from pathlib import Path

from workspace import ensure_dir, workspace_path

from app.agent_workflows.schemas import AgentWorkflowRecord


class AgentWorkflowRegistry:
    """Load/save/delete workflow JSON files under ``agent/workflows/``."""

    WORKFLOWS_DIR = "agent/workflows"

    @classmethod
    def _workflows_dir(cls) -> Path:
        return ensure_dir(cls.WORKFLOWS_DIR)

    @classmethod
    def _workflow_path(cls, wf_id: str) -> Path:
        return workspace_path(cls.WORKFLOWS_DIR, f"{wf_id}.json")

    @classmethod
    def _read_record(cls, path: Path) -> AgentWorkflowRecord | None:
        if not path.is_file():
            return None
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return None
        data = json.loads(raw)
        return AgentWorkflowRecord.model_validate(data)

    @classmethod
    def _write_record(cls, rec: AgentWorkflowRecord) -> None:
        cls._workflows_dir()
        path = cls._workflow_path(rec.id)
        path.write_text(
            json.dumps(rec.model_dump(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    @classmethod
    def list_all(cls) -> list[AgentWorkflowRecord]:
        d = cls._workflows_dir()
        records: list[AgentWorkflowRecord] = []
        for p in sorted(d.glob("*.json")):
            rec = cls._read_record(p)
            if rec is not None:
                records.append(rec)
        return records

    @classmethod
    def get_by_id(cls, wf_id: str) -> AgentWorkflowRecord | None:
        return cls._read_record(cls._workflow_path(wf_id))

    @classmethod
    def save(cls, rec: AgentWorkflowRecord) -> None:
        cls._write_record(rec)

    @classmethod
    def delete_by_id(cls, wf_id: str) -> bool:
        path = cls._workflow_path(wf_id)
        if not path.is_file():
            return False
        path.unlink()
        return True
