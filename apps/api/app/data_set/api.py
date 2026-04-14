from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.data_set.controller import (
    create_data_set as create_data_set_controller,
)
from app.data_set.controller import (
    delete_data_set as delete_data_set_controller,
)
from app.data_set.controller import (
    get_data_set_detail,
)
from app.data_set.controller import (
    get_data_set_workflow_template as get_data_set_workflow_template_controller,
)
from app.data_set.controller import (
    list_data_sets as list_data_sets_controller,
)
from app.data_set.controller import (
    update_data_set as update_data_set_controller,
)
from app.data_set.schemas import DataSetCreate, DataSetPatch, DataSetPublic

router = APIRouter(prefix="/data-sets", tags=["data-sets"])


@router.get("", response_model=list[DataSetPublic])
def list_data_sets() -> list[DataSetPublic]:
    return list_data_sets_controller()


@router.get("/workflow-template", response_model=dict)
def get_data_set_workflow_template() -> dict:
    return get_data_set_workflow_template_controller()


@router.get("/{data_set_id}", response_model=DataSetPublic)
def get_data_set(data_set_id: str) -> DataSetPublic:
    rec = get_data_set_detail(data_set_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return rec


@router.post("", response_model=DataSetPublic)
def create_data_set(body: DataSetCreate) -> DataSetPublic:
    try:
        return create_data_set_controller(body)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/{data_set_id}", response_model=DataSetPublic)
def patch_data_set(data_set_id: str, body: DataSetPatch) -> DataSetPublic:
    try:
        rec = update_data_set_controller(data_set_id, body)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if rec is None:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return rec


@router.delete("/{data_set_id}", status_code=204)
def delete_data_set(data_set_id: str) -> None:
    if not delete_data_set_controller(data_set_id):
        raise HTTPException(status_code=404, detail="数据集不存在")
