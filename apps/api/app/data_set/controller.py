from __future__ import annotations

from collections.abc import Callable

import pandas as pd
from factor.data_set import DataSet, DataSourceBinding
from fastapi import HTTPException
from workflow import WorkflowExecutor

from app.data_set.constants import empty_preprocessing_workflow_dict
from app.data_set.models import DataSetRow
from app.data_set.redistry import DataSetsStore
from app.data_set.schemas import (
    _EMPTY_WORKFLOW,
    DataSetCreate,
    DataSetDatasourceBindingInput,
    DataSetDatasourceBindingPublic,
    DataSetDatasourceBindingStored,
    DataSetPatch,
    DataSetPublic,
    _binding_to_stored_dict,
    _stored_workflow_str,
    workflow_public_dict,
)
from app.datasource.controller import get_datasource
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import utc_now_iso


def _build_preprocessor_from_workflow(
    workflow_json: str | None,
) -> Callable[[dict[str, pd.DataFrame]], pd.DataFrame] | None:
    """
    Turn stored workflow JSON into a frames-preprocessor callable.

    The callable matches DataSet's required signature:
    ``preprocessor(raw_frames: dict[str, pd.DataFrame]) -> pd.DataFrame``.
    """

    workflow = (workflow_json or "").strip()
    if not workflow:
        return None

    def _preprocessor(
        raw_frames: dict[str, pd.DataFrame],
    ) -> pd.DataFrame:
        executor = WorkflowExecutor()
        node_results = executor.execute(
            workflow,
            workflow_inputs=raw_frames,
        )
        workflow_out = (
            (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
        )
        workflow_out = workflow_out if isinstance(workflow_out, dict) else {}
        frames_out = workflow_out.get("frames")
        if frames_out is None:
            raise ValueError("工作流没有输出 workflow_outputs.frames")
        if not isinstance(frames_out, pd.DataFrame):
            raise ValueError("工作流输出 frames 必须是一个 DataFrame")
        return frames_out

    return _preprocessor


def get_data_set(id: str) -> DataSet | None:
    row = DataSetsStore.get_item(id)
    if row is None:
        return None

    bindings: list[DataSourceBinding] = []
    for b in _row_bindings(row):
        ds = get_datasource(b.datasource_id)
        if ds is None:
            continue

        bindings.append(
            DataSourceBinding(
                datasource=ds,
                columns=b.columns,
            )
        )

    start = (row.start or "").strip() or None
    end = (row.end or "").strip() or None
    codes = [c.strip() for c in (row.instrument_codes or []) if str(c).strip()]
    return DataSet(
        data_source_bindings=bindings,
        preprocessor=_build_preprocessor_from_workflow(row.preprocessing_workflow),
        start_date=start,
        end_date=end,
        instrument_codes=codes or None,
    )


def _ds_meta(ds_id: str) -> tuple[str, str]:
    r = DataSourceItemsRegistry.get_item(ds_id)
    if r is None:
        return "", ""
    return r.name, r.type


def _bindings_to_public(
    bindings: list[DataSetDatasourceBindingStored],
) -> list[DataSetDatasourceBindingPublic]:
    out: list[DataSetDatasourceBindingPublic] = []
    for b in bindings:
        name, typ = _ds_meta(b.datasource_id)
        out.append(
            DataSetDatasourceBindingPublic(
                datasource_id=b.datasource_id,
                datasource_name=name,
                datasource_type=typ,
                columns=list(b.columns),
            )
        )
    return out


def _row_bindings(row: DataSetRow) -> list[DataSetDatasourceBindingStored]:
    raw = row.datasource_bindings or []
    return [DataSetDatasourceBindingStored.model_validate(x) for x in raw]


def to_public(row: DataSetRow) -> DataSetPublic:
    return DataSetPublic(
        id=row.id,
        name=row.name,
        description=row.description,
        datasource_bindings=_bindings_to_public(_row_bindings(row)),
        preprocessing_workflow=workflow_public_dict(row.preprocessing_workflow),
        start=row.start,
        end=row.end,
        instrument_codes=list(row.instrument_codes or []),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _validate_datasource_exists(ds_id: str) -> None:
    row = DataSourceItemsRegistry.get_item(ds_id)
    if row is None:
        raise HTTPException(status_code=400, detail="数据源不存在")


def _strip_columns(columns: list[str]) -> list[str]:
    return [x.strip() for x in columns if str(x).strip()]


def _validate_binding_columns(
    *,
    columns: list[str],
    require_non_empty: bool,
    seen_fields: set[str],
) -> None:
    if require_non_empty and not columns:
        raise HTTPException(
            status_code=400,
            detail="每条绑定必须填写 columns（要加载的物理列名）",
        )
    for c in columns:
        if c in seen_fields:
            raise HTTPException(
                status_code=400,
                detail=f"列名「{c}」不能同时出现在多条数据源绑定中",
            )
        seen_fields.add(c)


def _validate_bindings_inputs(
    bindings: list[DataSetDatasourceBindingInput],
) -> None:
    if not bindings:
        raise HTTPException(status_code=400, detail="至少配置一条数据源绑定")
    seen_fields: set[str] = set()
    for b in bindings:
        ds = b.datasource_id.strip()
        if not ds:
            raise HTTPException(status_code=400, detail="数据源 id 不能为空")
        cols = _strip_columns(b.columns)
        _validate_binding_columns(
            columns=cols,
            require_non_empty=False,
            seen_fields=seen_fields,
        )


def _validate_and_touch_datasources(
    bindings: list[DataSetDatasourceBindingInput],
) -> None:
    _validate_bindings_inputs(bindings)
    for b in bindings:
        _validate_datasource_exists(b.datasource_id.strip())


def _merge_patch(row: DataSetRow, patch: DataSetPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        row.name = str(data["name"]).strip()
    if "description" in data:
        row.description = "" if data["description"] is None else str(data["description"]).strip()
    if "datasource_bindings" in data and data["datasource_bindings"] is not None:
        raw = data["datasource_bindings"]
        inputs = [DataSetDatasourceBindingInput.model_validate(x) for x in raw]
        row.datasource_bindings = [_binding_to_stored_dict(x) for x in inputs]
    if "preprocessing_workflow" in data:
        wf = data["preprocessing_workflow"]
        wf_obj = dict(_EMPTY_WORKFLOW) if wf is None else wf
        row.preprocessing_workflow = _stored_workflow_str(wf_obj)
    if "start" in data and data["start"] is not None:
        row.start = str(data["start"]).strip()
    if "end" in data and data["end"] is not None:
        row.end = str(data["end"]).strip()
    if "instrument_codes" in data and data["instrument_codes"] is not None:
        row.instrument_codes = [c.strip() for c in data["instrument_codes"] if str(c).strip()]


def list_data_sets() -> list[DataSetPublic]:
    return [to_public(i) for i in DataSetsStore.list_items()]


def get_data_set_detail(data_set_id: str) -> DataSetPublic | None:
    row = DataSetsStore.get_item(data_set_id)
    if row is None:
        return None
    return to_public(row)


def create_data_set(body: DataSetCreate) -> DataSetPublic:
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="名称不能为空")
    _validate_and_touch_datasources(list(body.datasource_bindings))
    new_row = body.to_row()
    created_row = DataSetsStore.add_item(new_row)
    return to_public(created_row)


def update_data_set(data_set_id: str, body: DataSetPatch) -> DataSetPublic | None:

    def _apply(row: DataSetRow) -> None:
        if body.datasource_bindings is not None:
            _validate_and_touch_datasources(list(body.datasource_bindings))
        _merge_patch(row, body)

        if not row.name:
            raise HTTPException(status_code=400, detail="名称不能为空")
        if not row.datasource_bindings:
            raise HTTPException(status_code=400, detail="至少保留一条数据源绑定")
        _validate_bindings_inputs(
            [
                DataSetDatasourceBindingInput(
                    datasource_id=b.datasource_id,
                    columns=list(b.columns),
                )
                for b in _row_bindings(row)
            ]
        )
        for b in _row_bindings(row):
            _validate_datasource_exists(b.datasource_id)
        row.updated_at = utc_now_iso()

    row = DataSetsStore.update_item(data_set_id, _apply)
    if row is None:
        return None
    return to_public(row)


def delete_data_set(data_set_id: str) -> bool:
    return DataSetsStore.delete_item(data_set_id) is not None


def get_data_set_workflow_template() -> dict:
    return empty_preprocessing_workflow_dict()


def get_data_set_panel_preview(
    data_set_id: str,
    *,
    limit: int = 200,
    sample_bdays: int = 5,
    window: int = 0,
) -> dict[str, object]:
    """
    Load a preprocessed panel for UI preview.

    - Uses DataSet.get_panel() -> applies preprocessing workflow.
    - Takes a short date window starting from dataset.start_date (sample_bdays).
    - Flattens MultiIndex(date, asset) into JSON rows.
    """
    ds = get_data_set(data_set_id)
    if ds is None:
        raise LookupError("数据集不存在")

    if not ds.start_date or not ds.end_date:
        raise ValueError("数据集 start/end 未配置")

    safe_limit = max(int(limit), 1)
    safe_sample_bdays = max(int(sample_bdays), 1)
    safe_window = max(int(window), 0)

    dataset_start = str(ds.start_date)
    dataset_end = str(ds.end_date)

    start_ts = pd.Timestamp(dataset_start).normalize()
    end_ts = pd.Timestamp(dataset_end).normalize()
    sample_end_ts = (start_ts + pd.offsets.BDay(safe_sample_bdays)).normalize()
    if sample_end_ts > end_ts:
        sample_end_ts = end_ts

    sample_start = start_ts.strftime("%Y-%m-%d")
    sample_end = sample_end_ts.strftime("%Y-%m-%d")
    fields = ds.list_preprocessed_fields(
        window=safe_window,
        start_date=sample_start,
        end_date=sample_end,
    )
    if not fields:
        raise ValueError("无法预览：预处理结果没有可用字段")

    panel = ds.get_panel(
        fields=fields,
        window=safe_window,
        start_date=sample_start,
        end_date=sample_end,
    )

    panel = panel.sort_index()
    if panel.shape[0] > safe_limit:
        panel = panel.head(safe_limit)

    # Raw CSV: no reset_index / no columns/rows normalization.
    csv = panel.to_csv()
    return {"csv": csv}
