from __future__ import annotations

from fastapi import APIRouter, HTTPException

from . import controller
from .schemas import (
    SubagentToolConfigListPublic,
    SubagentToolConfigPublic,
    SubagentToolConfigUpdateBody,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/subagents/tools", response_model=SubagentToolConfigListPublic)
def list_subagent_tools() -> SubagentToolConfigListPublic:
    return controller.list_subagent_tool_configs()


@router.put("/subagents/{subagent_id}/tools", response_model=SubagentToolConfigPublic)
def put_subagent_tools(
    subagent_id: str, body: SubagentToolConfigUpdateBody
) -> SubagentToolConfigPublic:
    try:
        return controller.update_subagent_tools(subagent_id, body.tool_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
