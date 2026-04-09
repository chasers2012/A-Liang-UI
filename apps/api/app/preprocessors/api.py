from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.common.datetime_utils import utc_now_iso
from app.evaluation.profile.schemas import EvaluationNodeTypePublic, WorkflowIOSpecPublic
from app.preprocessors.constants import DEFAULT_PREPROCESSOR_SOURCE
from app.preprocessors.controller import (
    apply_preprocessor_patch,
    get_preprocessor_record,
    list_preprocessor_records,
    load_preprocessor,
    load_preprocessor_detail,
    sync_preprocessor_metadata_from_source,
    update_preprocessor_record,
    write_preprocessor_source,
)
from app.preprocessors.controller import (
    create_preprocessor as create_preprocessor_controller,
)
from app.preprocessors.controller import (
    delete_preprocessor as delete_preprocessor_controller,
)
from app.preprocessors.schemas import (
    PreprocessorCreate,
    PreprocessorDetailPublic,
    PreprocessorPatch,
    PreprocessorSummaryPublic,
)
from app.preprocessors.workflow_node_types import (
    get_preprocessor_workflow_io_spec,
    list_preprocessor_node_types_public,
)

router = APIRouter(prefix="/preprocessors", tags=["preprocessors"])


@router.get("", response_model=list[PreprocessorSummaryPublic])
def list_preprocessors() -> list[PreprocessorSummaryPublic]:
    return [x for i in list_preprocessor_records() if (x := load_preprocessor(i.id)) is not None]


@router.get("/template", response_model=str)
def get_preprocessor_template() -> str:
    return DEFAULT_PREPROCESSOR_SOURCE


@router.post("", response_model=PreprocessorDetailPublic)
def create_preprocessor(body: PreprocessorCreate) -> PreprocessorDetailPublic:
    try:
        rec = create_preprocessor_controller(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    detail = load_preprocessor_detail(rec.id)
    if detail is None:
        raise HTTPException(status_code=500, detail="预处理器创建后加载失败")
    return detail


@router.get("/node-types", response_model=list[EvaluationNodeTypePublic])
def list_node_types() -> list[EvaluationNodeTypePublic]:
    # NOTE: this must appear before `/{preprocessor_id}` routes,
    # otherwise `node-types` can be matched as a `preprocessor_id` and return 404.
    return list_preprocessor_node_types_public()


@router.get("/workflow-io", response_model=WorkflowIOSpecPublic)
def get_workflow_io() -> WorkflowIOSpecPublic:
    return get_preprocessor_workflow_io_spec()


@router.get("/{preprocessor_id}", response_model=PreprocessorDetailPublic)
def get_preprocessor(preprocessor_id: str) -> PreprocessorDetailPublic:
    detail = load_preprocessor_detail(preprocessor_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="预处理器不存在")
    return detail


@router.patch("/{preprocessor_id}", response_model=PreprocessorDetailPublic)
def patch_preprocessor(preprocessor_id: str, body: PreprocessorPatch) -> PreprocessorDetailPublic:
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec) -> None:
        apply_preprocessor_patch(rec, body)
        if "source" in unset and body.source is not None:
            try:
                write_preprocessor_source(rec, body.source)
                sync_preprocessor_metadata_from_source(rec)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        rec.updated_at = utc_now_iso()

    rec = update_preprocessor_record(preprocessor_id, _apply)
    if rec is None:
        raise HTTPException(status_code=404, detail="预处理器不存在")
    loaded = load_preprocessor_detail(rec.id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="预处理器不存在")
    return loaded


@router.delete("/{preprocessor_id}", status_code=204)
def delete_preprocessor(preprocessor_id: str) -> None:
    if get_preprocessor_record(preprocessor_id) is None:
        raise HTTPException(status_code=404, detail="预处理器不存在")
    if delete_preprocessor_controller(preprocessor_id) is None:
        raise HTTPException(status_code=404, detail="预处理器不存在")
