from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from sqlmodel import select

from app.persistence.sqlite_db import get_session

from . import controller
from .models import ChatToolRow, ToolAuthorization

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("")
def list_tools() -> list[dict]:
    tools = controller.get_tools()
    available = set(tools.keys())
    with get_session() as session:
        rows = list(session.exec(select(ChatToolRow)))

    persisted_by_id = {r.id: r for r in rows}
    merged_ids = sorted({*available, *persisted_by_id.keys()})
    out: list[dict] = []
    for tid in merged_ids:
        rec = persisted_by_id.get(tid)
        tool_obj = tools.get(tid)
        # Prefer langchain tool metadata; fallback to docstring if any.
        description = ""
        if tool_obj is not None:
            raw = getattr(tool_obj, "description", None)
            if isinstance(raw, str) and raw.strip():
                description = raw.strip()
            else:
                description = (getattr(tool_obj, "__doc__", "") or "").strip()
        out.append(
            {
                "id": tid,
                "name": (rec.name if rec is not None and rec.name else tid),
                "description": description,
                "category": (rec.category if rec is not None else ""),
                "authorization": (
                    rec.authorization.value
                    if rec is not None
                    else ToolAuthorization.need_authorize.value
                ),
                "updated_at": rec.updated_at if rec is not None else None,
                "loaded": tid in available,
            }
        )
    return out


class ToolUpdateBody(BaseModel):
    authorization: ToolAuthorization


@router.patch("/{tool_id}")
def update_tool(tool_id: str, body: ToolUpdateBody) -> dict:
    tid = (tool_id or "").strip()
    if not tid:
        raise ValueError("tool_id 不能为空")
    with get_session() as session:
        rec = session.get(ChatToolRow, tid)
        if rec is None:
            # Allow creating a row for a tool name that exists in memory but not yet persisted.
            rec = ChatToolRow(
                id=tid,
                name=tid,
                category="",
                updated_at="",
                authorization=body.authorization,
            )
        rec.authorization = body.authorization
        session.merge(rec)
        session.commit()
        session.refresh(rec)
        return {
            "id": rec.id,
            "authorization": rec.authorization.value,
            "updated_at": rec.updated_at,
        }
