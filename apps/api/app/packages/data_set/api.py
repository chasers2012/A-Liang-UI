from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.packages.data_set.schemas import (
    DataSetCreate,
    DataSetPanelPreviewCsvResponse,
    DataSetPatch,
    DataSetPublic,
)

from . import controller

router = APIRouter(prefix="/data-sets", tags=["data-sets"])


@router.get("", response_model=list[DataSetPublic])
def list_data_sets() -> list[DataSetPublic]:
    return controller.list_data_sets()


@router.get("/workflow-template", response_model=dict)
def get_data_set_workflow_template() -> dict:
    return controller.get_data_set_workflow_template()


@router.get("/{data_set_id}", response_model=DataSetPublic)
def get_data_set(data_set_id: str) -> DataSetPublic:
    rec = controller.get_data_set_detail(data_set_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return rec


@router.post("", response_model=DataSetPublic)
def create_data_set(body: DataSetCreate) -> DataSetPublic:
    try:
        return controller.create_data_set(body)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/{data_set_id}", response_model=DataSetPublic)
def patch_data_set(data_set_id: str, body: DataSetPatch) -> DataSetPublic:
    try:
        rec = controller.update_data_set(data_set_id, body)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if rec is None:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return rec


@router.delete("/{data_set_id}", status_code=204)
def delete_data_set(data_set_id: str) -> None:
    if not controller.delete_data_set(data_set_id):
        raise HTTPException(status_code=404, detail="数据集不存在")


@router.get(
    "/{data_set_id}/panel-preview",
    response_model=DataSetPanelPreviewCsvResponse,
)
def preview_data_set_panel(
    data_set_id: str,
    limit: int = 200,
    sample_bdays: int = 5,
    window: int = 0,
) -> DataSetPanelPreviewCsvResponse:
    try:
        return controller.get_data_set_panel_preview(
            data_set_id,
            limit=limit,
            sample_bdays=sample_bdays,
            window=window,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
