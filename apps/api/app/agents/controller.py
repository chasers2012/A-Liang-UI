from __future__ import annotations

from sqlmodel import delete, select

from app.common.datetime_utils import utc_now_iso
from app.persistence.sqlite_db import get_session
from app.tool import controller as tool_controller

from .models import SubagentToolBindingRow
from .schemas import (
    SubagentToolConfigListPublic,
    SubagentToolConfigPublic,
    SubagentToolPublic,
)
from .subagent_catalog import SUBAGENT_CATALOG, get_subagent_catalog_item


def _normalize_tool_ids(values: list[str]) -> list[str]:
    out = [str(v).strip() for v in values if str(v).strip()]
    return list(dict.fromkeys(out))


def list_available_tools() -> list[SubagentToolPublic]:
    tools = tool_controller.get_tools()
    rows = []
    for tool_id in sorted(tools.keys()):
        tool_obj = tools.get(tool_id)
        description = ""
        if tool_obj is not None:
            raw_description = getattr(tool_obj, "description", None)
            if isinstance(raw_description, str) and raw_description.strip():
                description = raw_description.strip()
            else:
                description = (getattr(tool_obj, "__doc__", "") or "").strip()
        rows.append(
            SubagentToolPublic(
                id=tool_id,
                name=tool_id,
                description=description,
                category="",
                loaded=True,
            )
        )
    return rows


def _list_bindings_for_subagent(subagent_id: str) -> list[SubagentToolBindingRow]:
    with get_session() as session:
        return list(
            session.exec(
                select(SubagentToolBindingRow).where(
                    SubagentToolBindingRow.subagent_id == subagent_id
                )
            )
        )


def get_subagent_tool_ids(subagent_id: str, default_tool_ids: set[str] | list[str]) -> list[str]:
    defaults = _normalize_tool_ids(list(default_tool_ids))
    tool_ids_by_runtime = set(tool_controller.get_tools().keys())
    rows = _list_bindings_for_subagent(subagent_id)
    if not rows:
        return [tid for tid in defaults if tid in tool_ids_by_runtime]
    selected = _normalize_tool_ids([row.tool_id for row in rows])
    return [tid for tid in selected if tid in tool_ids_by_runtime]


def _build_subagent_tool_config(subagent_id: str) -> SubagentToolConfigPublic:
    item = get_subagent_catalog_item(subagent_id)
    if item is None:
        raise ValueError(f"未知 subagent: {subagent_id}")
    defaults = _normalize_tool_ids(list(item.default_tool_ids))
    selected = get_subagent_tool_ids(item.id, defaults)
    return SubagentToolConfigPublic(
        subagent_id=item.id,
        title=item.title,
        description=item.description,
        default_tool_ids=defaults,
        tool_ids=selected,
    )


def list_subagent_tool_configs() -> SubagentToolConfigListPublic:
    return SubagentToolConfigListPublic(
        subagents=[_build_subagent_tool_config(item.id) for item in SUBAGENT_CATALOG],
        tools=list_available_tools(),
    )


def update_subagent_tools(subagent_id: str, tool_ids: list[str]) -> SubagentToolConfigPublic:
    item = get_subagent_catalog_item(subagent_id)
    if item is None:
        raise ValueError(f"未知 subagent: {subagent_id}")
    normalized = _normalize_tool_ids(tool_ids)
    available = set(tool_controller.get_tools().keys())
    invalid = [tid for tid in normalized if tid not in available]
    if invalid:
        raise ValueError(f"以下工具不存在或未加载: {', '.join(invalid)}")
    now = utc_now_iso()
    with get_session() as session:
        session.exec(
            delete(SubagentToolBindingRow).where(SubagentToolBindingRow.subagent_id == item.id)
        )
        for tid in normalized:
            session.add(SubagentToolBindingRow(subagent_id=item.id, tool_id=tid, updated_at=now))
        session.commit()
    return _build_subagent_tool_config(item.id)
