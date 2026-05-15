from __future__ import annotations

import json
from typing import Any

from workflow.schemas import WorkflowGraphPersisted


def normalize_datasource_ids(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for x in raw:
        s = str(x).strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def payload_source_ids(payload: dict[str, Any]) -> list[str]:
    return normalize_datasource_ids(payload.get("source_datasource_ids"))


def payload_target_ids(payload: dict[str, Any]) -> list[str]:
    return normalize_datasource_ids(payload.get("target_datasource_ids"))


def payload_sync_workflow_dict(payload: dict[str, Any]) -> dict[str, Any]:
    raw = payload.get("sync_workflow")
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return dict(raw)
    raise ValueError("sync_workflow 必须是对象")


def _workflow_nodes_empty(workflow: dict[str, Any]) -> bool:
    nodes = workflow.get("nodes")
    if not isinstance(nodes, list):
        return True
    return len(nodes) == 0


def normalize_sync_workflow(workflow: dict[str, Any]) -> dict[str, Any] | None:
    if not workflow or _workflow_nodes_empty(workflow):
        return None
    return WorkflowGraphPersisted.model_validate(workflow).model_dump(by_alias=True)


def _normalized_workflow(payload: dict[str, Any]) -> dict[str, Any] | None:
    wf_raw = payload_sync_workflow_dict(payload)
    return normalize_sync_workflow(wf_raw) if wf_raw else None


def validate_sync_payload(payload: dict[str, Any]) -> None:
    source_ids = payload_source_ids(payload)
    target_ids = payload_target_ids(payload)
    if not source_ids:
        raise ValueError("请至少配置一个源数据源（source_datasource_ids）。")
    if not target_ids:
        raise ValueError("请至少配置一个目标数据源（target_datasource_ids）。")
    if set(source_ids) & set(target_ids):
        raise ValueError("源数据源与目标数据源列表不得有交集。")
    wf_norm = _normalized_workflow(payload)
    if len(source_ids) > 1 and not wf_norm:
        raise ValueError("多源同步须配置非空的 sync_workflow，以合并/处理多路 DataFrame")


def prepare_sync_run(
    payload: dict[str, Any],
) -> tuple[list[str], list[str], str]:
    """Validate payload and return source ids, target ids, workflow JSON for execution."""
    validate_sync_payload(payload)
    wf_norm = _normalized_workflow(payload)
    wf_json = json.dumps(wf_norm, ensure_ascii=False) if wf_norm else ""
    return payload_source_ids(payload), payload_target_ids(payload), wf_json


def normalize_sync_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize sync task payload to canonical keys."""
    source_ids = payload_source_ids(payload)
    target_ids = payload_target_ids(payload)
    out = dict(payload)
    if source_ids:
        out["source_datasource_ids"] = source_ids
    if target_ids:
        out["target_datasource_ids"] = target_ids
    wf_norm = _normalized_workflow(out)
    if wf_norm is not None:
        out["sync_workflow"] = wf_norm
    elif "sync_workflow" in out:
        del out["sync_workflow"]
    return out
