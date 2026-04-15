from __future__ import annotations

from factor.data_set import DataSet, DataSourceBinding
from fastapi import HTTPException

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
from app.preprocessors.controller import list_preprocessor_records


def get_data_set(id: str) -> DataSet | None:
    row = DataSetsStore.get_item(id)
    if row is None:
        return None

    bindings: list[DataSourceBinding] = []
    for b in _row_bindings(row):
        ds = get_datasource(b.datasource_id)
        if ds is None:
            continue
        date_col = b.date_column.strip()
        asset_col = b.asset_column.strip()
        alias = b.alias

        bindings.append(
            DataSourceBinding(
                datasource=ds,
                dependencies=b.dependencies,
                alias=alias,
                date_column=date_col,
                asset_column=asset_col,
            )
        )

    start = (row.start or "").strip() or None
    end = (row.end or "").strip() or None
    codes = [c.strip() for c in (row.instrument_codes or []) if str(c).strip()]
    return DataSet(
        data_source_bindings=bindings,
        preprocessing_workflow=row.preprocessing_workflow,
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
                dependencies=list(b.dependencies),
                alias=(dict(b.alias) if b.alias else None),
                date_column=b.date_column.strip(),
                asset_column=b.asset_column.strip(),
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
        preprocessors=list(row.preprocessors or []),
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


def _validate_binding_alias(alias: dict | None) -> None:
    if alias is None:
        return
    for k, v in alias.items():
        kk = str(k).strip()
        vv = str(v).strip()
        if not kk or not vv:
            raise HTTPException(status_code=400, detail="alias 中的键和值均不能为空")


def _strip_deps(deps: list[str]) -> list[str]:
    return [x.strip() for x in deps if str(x).strip()]


def _extract_preprocessors_from_workflow(workflow: dict) -> list[str]:
    nodes = workflow.get("nodes", [])
    if not isinstance(nodes, list):
        return []
    known_ids = {r.id for r in list_preprocessor_records()}
    out: list[str] = []
    seen: set[str] = set()
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_type = str(node.get("type", "")).strip()
        if not node_type or node_type in seen:
            continue
        if node_type not in known_ids:
            continue
        seen.add(node_type)
        out.append(node_type)
    return out


def _validate_binding_dependencies(
    *,
    deps: list[str],
    require_non_empty: bool,
    seen_fields: set[str],
) -> None:
    if require_non_empty and not deps:
        raise HTTPException(
            status_code=400,
            detail="多个数据源时，每条绑定必须填写 dependencies（因子依赖字段名，如 close、volume）",
        )
    for d in deps:
        if d in seen_fields:
            raise HTTPException(
                status_code=400,
                detail=f"依赖字段「{d}」不能同时出现在多条数据源绑定中",
            )
        seen_fields.add(d)


def _validate_bindings_inputs(
    bindings: list[DataSetDatasourceBindingInput],
) -> None:
    if not bindings:
        raise HTTPException(status_code=400, detail="至少配置一条数据源绑定")
    n = len(bindings)
    seen_fields: set[str] = set()
    for b in bindings:
        ds = b.datasource_id.strip()
        if not ds:
            raise HTTPException(status_code=400, detail="数据源 id 不能为空")
        if not b.date_column.strip() or not b.asset_column.strip():
            raise HTTPException(
                status_code=400, detail="每条绑定必须填写 date_column 与 asset_column"
            )
        _validate_binding_alias(b.alias)
        deps = _strip_deps(b.dependencies)
        _validate_binding_dependencies(
            deps=deps,
            require_non_empty=n > 1,
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
        row.preprocessors = _extract_preprocessors_from_workflow(dict(wf_obj))
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
    new_row.preprocessors = _extract_preprocessors_from_workflow(dict(body.preprocessing_workflow))
    DataSetsStore.add_item(new_row)
    return to_public(new_row)


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
                    dependencies=list(b.dependencies),
                    alias=(dict(b.alias) if b.alias else None),
                    date_column=b.date_column,
                    asset_column=b.asset_column,
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
