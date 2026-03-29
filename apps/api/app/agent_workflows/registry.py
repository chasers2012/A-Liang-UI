"""Per-file registry for agent workflows (config/agent_workflows/{id}.json)."""

from __future__ import annotations

import json
from pathlib import Path

from workspace import ensure_dir, workspace_path

from app.agent_workflows.schemas import AgentWorkflowRecord


class AgentWorkflowRegistry:
    """Load/save/delete workflow JSON files under ``config/agent_workflows/``."""

    WORKFLOWS_DIR = "config/agent_workflows"

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
    def _build_default_workflow(cls) -> AgentWorkflowRecord:
        """Reproduce the hardcoded factor-digging graph from lib/agent/agent/graph.py."""
        from app.agent_workflows.schemas import (
            AgentGraphLink,
            AgentGraphNode,
            AgentGraphState,
        )
        from app.datetime_utils import utc_now_iso

        now = utc_now_iso()
        nodes = [
            AgentGraphNode(id="init_context", type="init_context", pos=(200, 0)),
            AgentGraphNode(id="ideate", type="ideate", pos=(200, 120)),
            AgentGraphNode(id="generate_pseudocode", type="generate_pseudocode", pos=(200, 240)),
            AgentGraphNode(id="generate_code", type="generate_code", pos=(200, 360)),
            AgentGraphNode(id="validate", type="validate", pos=(200, 480)),
            AgentGraphNode(id="evaluate", type="evaluate", pos=(200, 640)),
            AgentGraphNode(id="finalize", type="finalize", pos=(200, 800)),
        ]
        links = [
            AgentGraphLink(
                from_node="init_context", from_socket="next", to_node="ideate", to_socket="prev"
            ),
            AgentGraphLink(
                from_node="ideate",
                from_socket="next",
                to_node="generate_pseudocode",
                to_socket="prev",
            ),
            AgentGraphLink(
                from_node="generate_pseudocode",
                from_socket="next",
                to_node="generate_code",
                to_socket="prev",
            ),
            AgentGraphLink(
                from_node="generate_code", from_socket="next", to_node="validate", to_socket="prev"
            ),
            AgentGraphLink(
                from_node="validate", from_socket="evaluate", to_node="evaluate", to_socket="prev"
            ),
            AgentGraphLink(
                from_node="validate",
                from_socket="regenerate",
                to_node="generate_code",
                to_socket="prev",
            ),
            AgentGraphLink(
                from_node="validate", from_socket="finalize", to_node="finalize", to_socket="prev"
            ),
            AgentGraphLink(
                from_node="evaluate", from_socket="next", to_node="finalize", to_socket="prev"
            ),
        ]
        return AgentWorkflowRecord(
            id="default-factor-digging",
            name="因子挖掘",
            description="默认因子挖掘工作流：立意 → 伪代码 → 代码生成 → 校验 → 评价 → 报告",
            graph=AgentGraphState(nodes=nodes, links=links, viewport=None),
            created_at=now,
            updated_at=now,
        )

    @classmethod
    def _ensure_default(cls) -> None:
        """Seed the default workflow if the directory is empty."""
        d = cls._workflows_dir()
        if any(d.glob("*.json")):
            return
        cls._write_record(cls._build_default_workflow())

    @classmethod
    def list_all(cls) -> list[AgentWorkflowRecord]:
        cls._ensure_default()
        d = cls._workflows_dir()
        records: list[AgentWorkflowRecord] = []
        for p in sorted(d.glob("*.json")):
            rec = cls._read_record(p)
            if rec is not None:
                records.append(rec)
        return records

    @classmethod
    def get_by_id(cls, wf_id: str) -> AgentWorkflowRecord | None:
        cls._ensure_default()
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
