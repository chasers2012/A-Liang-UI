"""CRUD endpoints for agent workflows and node-type catalog."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent_workflows.registry import AgentWorkflowRegistry
from app.agent_workflows.schemas import (
    AgentWorkflowCreate,
    AgentWorkflowDetailPublic,
    AgentWorkflowPatch,
    AgentWorkflowSummaryPublic,
    row_to_detail,
    row_to_summary,
)
from app.common.datetime_utils import utc_now_iso

router = APIRouter(prefix="/agent/workflows", tags=["agent"])


@router.get("", response_model=list[AgentWorkflowSummaryPublic])
def list_workflows() -> list[AgentWorkflowSummaryPublic]:
    return [row_to_summary(r) for r in AgentWorkflowRegistry.list_all()]


@router.get("/{wf_id}", response_model=AgentWorkflowDetailPublic)
def get_workflow(wf_id: str) -> AgentWorkflowDetailPublic:
    row = AgentWorkflowRegistry.get_by_id(wf_id)
    if row is None:
        raise HTTPException(status_code=404, detail="工作流不存在")
    return row_to_detail(row)


@router.post("", response_model=AgentWorkflowDetailPublic)
def create_workflow(body: AgentWorkflowCreate) -> AgentWorkflowDetailPublic:
    new_row = body.to_row()
    AgentWorkflowRegistry.save(new_row)
    return row_to_detail(new_row)


@router.patch("/{wf_id}", response_model=AgentWorkflowDetailPublic)
def patch_workflow(wf_id: str, body: AgentWorkflowPatch) -> AgentWorkflowDetailPublic:
    row = AgentWorkflowRegistry.get_by_id(wf_id)
    if row is None:
        raise HTTPException(status_code=404, detail="工作流不存在")

    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        row.name = data["name"]
    if "description" in data:
        row.description = data["description"]
    if "graph" in data and body.graph is not None:
        row.graph = body.graph
    row.updated_at = utc_now_iso()
    AgentWorkflowRegistry.save(row)
    return row_to_detail(row)


@router.delete("/{wf_id}", status_code=204)
def delete_workflow(wf_id: str) -> None:
    if not AgentWorkflowRegistry.delete_by_id(wf_id):
        raise HTTPException(status_code=404, detail="工作流不存在")
