"""CRUD endpoints for agent workflows and node-type catalog."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from workflow.parser import Parser

from app.agent_workflows.nodes import get_agent_node_types
from app.agent_workflows.registry import AgentWorkflowRegistry
from app.agent_workflows.schemas import (
    AgentWorkflowCreate,
    AgentWorkflowDetailPublic,
    AgentWorkflowPatch,
    AgentWorkflowSummaryPublic,
    record_to_detail,
    record_to_summary,
)
from app.common.datetime_utils import utc_now_iso

router = APIRouter(prefix="/agent/workflows", tags=["agent"])


@router.get("/node-types", response_model=list[dict[str, Any]])
def list_node_types() -> list[dict[str, Any]]:
    # Return the node's own serialized shape directly (no DTO conversion layer).
    return [Parser.serialize_node(s) for s in get_agent_node_types()]


@router.get("", response_model=list[AgentWorkflowSummaryPublic])
def list_workflows() -> list[AgentWorkflowSummaryPublic]:
    return [record_to_summary(r) for r in AgentWorkflowRegistry.list_all()]


@router.get("/{wf_id}", response_model=AgentWorkflowDetailPublic)
def get_workflow(wf_id: str) -> AgentWorkflowDetailPublic:
    rec = AgentWorkflowRegistry.get_by_id(wf_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="工作流不存在")
    return record_to_detail(rec)


@router.post("", response_model=AgentWorkflowDetailPublic)
def create_workflow(body: AgentWorkflowCreate) -> AgentWorkflowDetailPublic:
    new_rec = body.to_record()
    AgentWorkflowRegistry.save(new_rec)
    return record_to_detail(new_rec)


@router.patch("/{wf_id}", response_model=AgentWorkflowDetailPublic)
def patch_workflow(wf_id: str, body: AgentWorkflowPatch) -> AgentWorkflowDetailPublic:
    rec = AgentWorkflowRegistry.get_by_id(wf_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="工作流不存在")

    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        rec.name = data["name"]
    if "description" in data:
        rec.description = data["description"]
    if "graph" in data and body.graph is not None:
        rec.graph = body.graph
    rec.updated_at = utc_now_iso()
    AgentWorkflowRegistry.save(rec)
    return record_to_detail(rec)


@router.delete("/{wf_id}", status_code=204)
def delete_workflow(wf_id: str) -> None:
    if not AgentWorkflowRegistry.delete_by_id(wf_id):
        raise HTTPException(status_code=404, detail="工作流不存在")
