from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.datasources.schemas import utc_now_iso
from app.evaluation.graph_validate import validate_workflow_graph
from app.evaluation.metric_schemas import RESULT_VIZ_NODE_WORKFLOW_PARAMETERS
from app.evaluation.metrics_store import get_by_id as metric_get_by_id
from app.evaluation.metrics_store import load_registry as load_metrics_registry
from app.evaluation.node_type_registry import sorted_viz_node_type_ids
from app.evaluation.profile_schemas import (
    EvaluationProfileCreate,
    EvaluationProfilePatch,
    EvaluationProfilePublic,
    NodeTypeDefinitionPublic,
    NodeTypeSocketPublic,
)
from app.evaluation.profiles_store import (
    apply_default_uniqueness,
    get_by_id,
    load_file,
    save_file,
)
from app.evaluation.workflow_graph_types import all_workflow_node_type_ids, workflow_node_definition
from app.evaluation.workflow_migrate import migrate_evaluation_workflow

router = APIRouter(prefix="/evaluation-profiles", tags=["evaluation-profiles"])


def _to_public(rec) -> EvaluationProfilePublic:
    wf = migrate_evaluation_workflow(rec.workflow)
    return EvaluationProfilePublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        test_set_id=rec.test_set_id,
        prepare=rec.prepare,
        workflow=wf,
        is_default=rec.is_default,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _validate_workflow_if_needed(wf) -> None:
    if not wf.nodes:
        return
    wf = migrate_evaluation_workflow(wf)
    try:
        validate_workflow_graph(wf, allowed_types=all_workflow_node_type_ids())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/node-types", response_model=list[NodeTypeDefinitionPublic])
def list_node_types() -> list[NodeTypeDefinitionPublic]:
    metrics_reg = load_metrics_registry()
    out: list[NodeTypeDefinitionPublic] = []
    prep = workflow_node_definition("prepare_alphalens")
    out.append(
        NodeTypeDefinitionPublic(
            type=prep.type,
            label=prep.label,
            description=prep.description,
            inputs=[
                NodeTypeSocketPublic(name=s.name, required=s.required, value_type=s.value_type)
                for s in prep.inputs
            ],
            outputs=[
                NodeTypeSocketPublic(name=s.name, required=False, value_type=s.value_type)
                for s in prep.outputs
            ],
            workflow_parameters=[],
            user_defined=False,
            metric_id=None,
        )
    )
    for vid in sorted_viz_node_type_ids():
        vs = workflow_node_definition(vid)
        out.append(
            NodeTypeDefinitionPublic(
                type=vs.type,
                label=vs.label,
                description=vs.description,
                inputs=[
                    NodeTypeSocketPublic(name=s.name, required=s.required, value_type=s.value_type)
                    for s in vs.inputs
                ],
                outputs=[
                    NodeTypeSocketPublic(name=s.name, required=False, value_type=s.value_type)
                    for s in vs.outputs
                ],
                workflow_parameters=list(RESULT_VIZ_NODE_WORKFLOW_PARAMETERS),
                user_defined=False,
                metric_id=None,
            )
        )
    allowed = all_workflow_node_type_ids()
    for nt in sorted(allowed):
        if nt == "prepare_alphalens" or nt.startswith("viz_"):
            continue
        spec = workflow_node_definition(nt)
        mid = nt.removeprefix("metric:") if nt.startswith("metric:") else None
        mrec = metric_get_by_id(metrics_reg, mid) if mid else None
        wp = list(mrec.workflow_parameters) if mrec is not None else []
        out.append(
            NodeTypeDefinitionPublic(
                type=spec.type,
                label=spec.label,
                description=spec.description,
                inputs=[
                    NodeTypeSocketPublic(name=s.name, required=s.required, value_type=s.value_type)
                    for s in spec.inputs
                ],
                outputs=[
                    NodeTypeSocketPublic(name=s.name, required=False, value_type=s.value_type)
                    for s in spec.outputs
                ],
                workflow_parameters=wp,
                user_defined=bool(mid and mrec is not None and not mrec.builtin),
                metric_id=mid,
            )
        )
    return out


@router.get("", response_model=list[EvaluationProfilePublic])
def list_evaluation_profiles() -> list[EvaluationProfilePublic]:
    reg = load_file()
    return [_to_public(i) for i in reg.items]


@router.get("/{profile_id}", response_model=EvaluationProfilePublic)
def get_evaluation_profile(profile_id: str) -> EvaluationProfilePublic:
    reg = load_file()
    rec = get_by_id(reg, profile_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价方案不存在")
    return _to_public(rec)


@router.post("", response_model=EvaluationProfilePublic)
def create_evaluation_profile(body: EvaluationProfileCreate) -> EvaluationProfilePublic:
    rec = body.to_record()
    if rec.workflow.nodes:
        rec = rec.model_copy(update={"workflow": migrate_evaluation_workflow(rec.workflow)})
    _validate_workflow_if_needed(rec.workflow)
    reg = load_file()
    reg.items.append(rec)
    if rec.is_default:
        apply_default_uniqueness(reg.items)
    save_file(reg)
    return _to_public(rec)


@router.patch("/{profile_id}", response_model=EvaluationProfilePublic)
def patch_evaluation_profile(
    profile_id: str, body: EvaluationProfilePatch
) -> EvaluationProfilePublic:
    reg = load_file()
    rec = get_by_id(reg, profile_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价方案不存在")

    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        if body.name is None or not str(body.name).strip():
            raise HTTPException(status_code=400, detail="name 不能为空")
        rec.name = str(body.name).strip()
    if "description" in data:
        rec.description = (body.description or "").strip()
    if "test_set_id" in data:
        tid = (body.test_set_id or "").strip() if body.test_set_id is not None else ""
        rec.test_set_id = tid or None
    if "prepare" in data and body.prepare is not None:
        rec.prepare = body.prepare
    if "workflow" in data and body.workflow is not None:
        _validate_workflow_if_needed(body.workflow)
        rec.workflow = migrate_evaluation_workflow(body.workflow)
    if "is_default" in data and body.is_default is not None:
        rec.is_default = body.is_default

    rec.updated_at = utc_now_iso()
    if rec.is_default:
        apply_default_uniqueness(reg.items)
    save_file(reg)
    return _to_public(rec)


@router.delete("/{profile_id}", status_code=204)
def delete_evaluation_profile(profile_id: str) -> None:
    reg = load_file()
    rec = get_by_id(reg, profile_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价方案不存在")
    reg.items = [i for i in reg.items if i.id != profile_id]
    save_file(reg)
