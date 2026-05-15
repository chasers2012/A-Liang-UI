from __future__ import annotations

import json
from typing import Any

from workflow.schemas import WorkflowGraphPersisted


def normalize_datasource_ids(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str) and raw.strip():
        return [raw.strip()]
    if isinstance(raw, list):
        out: list[str] = []
        seen: set[str] = set()
        for x in raw:
            s = str(x).strip()
            if not s or s in seen:
                continue
            seen.add(s)
            out.append(s)
        return out
    return []


def payload_source_ids(payload: dict[str, Any]) -> list[str]:
    ids = normalize_datasource_ids(payload.get("source_datasource_ids"))
    if ids:
        return ids
    one = str(payload.get("source_datasource_id", "")).strip()
    return [one] if one else []


def payload_target_ids(payload: dict[str, Any]) -> list[str]:
    ids = normalize_datasource_ids(payload.get("target_datasource_ids"))
    if ids:
        return ids
    one = str(payload.get("target_datasource_id", "")).strip()
    return [one] if one else []


def payload_sync_workflow_dict(payload: dict[str, Any]) -> dict[str, Any]:
    raw = payload.get("sync_workflow")
    if raw is None:
        return {}
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return {}
        try:
            loaded = json.loads(s)
        except json.JSONDecodeError as e:
            raise ValueError("sync_workflow JSON 无效") from e
        if not isinstance(loaded, dict):
            raise ValueError("sync_workflow JSON 须为对象")
        return dict(loaded)
    if isinstance(raw, dict):
        return dict(raw)
    raise ValueError("sync_workflow 必须是对象或 JSON 字符串")


def _workflow_nodes_empty(workflow: dict[str, Any]) -> bool:
    nodes = workflow.get("nodes")
    if not isinstance(nodes, list):
        return True
    return len(nodes) == 0


def validate_and_normalize_sync_workflow(workflow: dict[str, Any]) -> dict[str, Any] | None:
    if not workflow or _workflow_nodes_empty(workflow):
        return None
    return WorkflowGraphPersisted.model_validate(workflow).model_dump(by_alias=True)


def normalize_sync_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Ensure canonical source/target id fields on a sync task payload."""
    source_ids = payload_source_ids(payload)
    target_ids = payload_target_ids(payload)
    out = dict(payload)
    if source_ids:
        out["source_datasource_ids"] = source_ids
        out["source_datasource_id"] = source_ids[0]
    if target_ids:
        out["target_datasource_ids"] = target_ids
        out["target_datasource_id"] = target_ids[0]
    wf_raw = payload_sync_workflow_dict(out)
    if wf_raw:
        wf_norm = validate_and_normalize_sync_workflow(wf_raw)
        if wf_norm is not None:
            out["sync_workflow"] = wf_norm
        elif "sync_workflow" in out:
            del out["sync_workflow"]
    return out


def validate_sync_payload(payload: dict[str, Any]) -> None:
    source_ids = payload_source_ids(payload)
    target_ids = payload_target_ids(payload)
    if not source_ids:
        raise ValueError("请至少配置一个源数据源（source_datasource_ids）。")
    if not target_ids:
        raise ValueError("请至少配置一个目标数据源（target_datasource_ids）。")
    if set(source_ids) & set(target_ids):
        raise ValueError("源数据源与目标数据源列表不得有交集。")

    wf_raw = payload_sync_workflow_dict(payload)
    wf_norm = validate_and_normalize_sync_workflow(wf_raw) if wf_raw else None
    if len(source_ids) > 1 and not wf_norm:
        raise ValueError("多源同步须配置非空的 sync_workflow，以合并/处理多路 DataFrame")
