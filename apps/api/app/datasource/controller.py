from __future__ import annotations

from typing import Any

from data_source import DataSource, VerifyResult

from app.datasource.models import DataSourceRow
from app.datasource.plugins import get_datasource_plugin
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import (
    DataSourceCreate,
    DatasourceDependencyFieldsResponse,
    DataSourcePatch,
    DatasourcePluginPublic,
    DataSourcePublic,
    InspectColumnsRequest,
    InspectColumnsResponse,
    row_to_public,
    utc_now_iso,
)
from app.plugin import PluginRegistry


def _normalize_name(name: str) -> str:
    return str(name).strip()


def _pick_inspect_date_column(
    validated: dict[str, Any], normalized: list[str], col_set: set[str]
) -> str:
    dc = validated.get("date_column")
    if isinstance(dc, str) and dc.strip() in col_set:
        return dc.strip()
    for cand in ("date", "calendar_date", "statDate", "pubDate"):
        if cand in col_set:
            return cand
    for c in normalized:
        if str(c).lower().endswith("date"):
            return c
    return normalized[0]


def _pick_inspect_asset_column(
    validated: dict[str, Any],
    normalized: list[str],
    col_set: set[str],
    date_column: str,
) -> str | None:
    ac = validated.get("asset_column")
    if ac is not None:
        s = str(ac).strip()
        if s and s in col_set:
            return s
    for cand in ("code", "asset", "symbol"):
        if cand in col_set:
            return cand
    for c in normalized:
        if c != date_column:
            return c
    return None


def _build_inspect_columns_response(
    validated: dict[str, Any], cols: list[str]
) -> InspectColumnsResponse:
    normalized = [str(c).strip() for c in cols if str(c).strip()]
    col_set = set(normalized)

    if not normalized:
        dc = validated.get("date_column")
        date_fallback = str(dc).strip() if isinstance(dc, str) and str(dc).strip() else "date"
        ac = validated.get("asset_column")
        asset_fallback: str | None = None
        if ac is not None and str(ac).strip():
            asset_fallback = str(ac).strip()
        return InspectColumnsResponse(
            columns=[],
            date_column=date_fallback,
            asset_column=asset_fallback,
        )

    date_column = _pick_inspect_date_column(validated, normalized, col_set)
    asset_column = _pick_inspect_asset_column(validated, normalized, col_set, date_column)

    return InspectColumnsResponse(
        columns=normalized,
        date_column=date_column,
        asset_column=asset_column,
    )


def _ensure_unique_name(name: str, *, exclude_id: str | None = None) -> None:
    target = _normalize_name(name)
    for item in DataSourceItemsRegistry.list_items():
        if exclude_id and item.id == exclude_id:
            continue
        if _normalize_name(item.name) == target:
            raise ValueError(f"数据源名称已存在: {name}")


def _validate_datasource_storage(
    plugin_type: str,
    connection_config: dict[str, Any],
    columns_config: dict[str, Any],
    write_config: dict[str, Any] | None = None,
    *,
    datasource_id: str | None = None,
) -> dict[str, Any]:
    plugin = get_datasource_plugin(plugin_type)
    connection, columns, write = plugin.spec.split_write_config_for_validation(
        dict(connection_config or {}),
        dict(columns_config or {}),
        dict(write_config or {}) if write_config is not None else None,
    )
    config = {"connection": connection, "columns": columns, "write": write}
    if datasource_id:
        config = plugin.spec.prepare_storage_config(datasource_id, config)
    validated = plugin.spec.validate_config(config)
    return plugin.spec.encrypt_storage_config(validated)


def get_datasource(id: str) -> DataSource | None:
    rec = DataSourceItemsRegistry.get_item(id)
    if rec is None:
        return None
    plugin = get_datasource_plugin(rec.type)
    plain = plugin.spec.decrypt_storage_config(dict(rec.config or {}))
    return plugin.spec.to_datasource(plain)


def list_datasources() -> list[DataSourcePublic]:
    return [row_to_public(i) for i in DataSourceItemsRegistry.list_items()]


def list_datasource_plugins() -> list[DatasourcePluginPublic]:
    reg = PluginRegistry.instance()
    out: list[DatasourcePluginPublic] = []
    for ds_type, plugin in reg.list_registered_by_category("datasource"):
        connection_schema = plugin.spec.connection_schema
        columns_schema = plugin.spec.columns_schema
        title = (
            (connection_schema.title if connection_schema else None)
            or (columns_schema.title if columns_schema else None)
            or str(ds_type).upper()
        )
        description = (connection_schema.description if connection_schema else None) or (
            columns_schema.description if columns_schema else None
        )
        write_schema = plugin.spec.write_schema
        out.append(
            DatasourcePluginPublic(
                type=ds_type,
                title=title,
                description=description,
                connection_json_schema=(
                    dict(connection_schema.json_schema or {}) if connection_schema else {}
                ),
                connection_ui_schema=(
                    dict(connection_schema.ui_schema or {}) if connection_schema else {}
                ),
                columns_json_schema=dict(columns_schema.json_schema or {})
                if columns_schema
                else {},
                columns_ui_schema=dict(columns_schema.ui_schema or {}) if columns_schema else {},
                write_json_schema=dict(write_schema.json_schema or {}) if write_schema else {},
                write_ui_schema=dict(write_schema.ui_schema or {}) if write_schema else {},
            )
        )
    return out


def inspect_columns(body: InspectColumnsRequest) -> InspectColumnsResponse:
    config: dict = {}
    ds_type: str | None = body.type
    if body.datasource_id:
        rec = DataSourceItemsRegistry.get_item(body.datasource_id)
        if rec is None:
            raise LookupError("数据源不存在")
        ds_type = str(rec.type)
        plugin = get_datasource_plugin(ds_type)
        saved = dict(rec.config or {})
        if body.config is not None:
            config = plugin.spec.merge_overlay_with_saved_secrets(
                saved,
                dict(body.config),
            )
        else:
            config = plugin.spec.decrypt_storage_config(dict(saved or {}))
    else:
        if not ds_type:
            raise ValueError("type is required when datasource_id is not provided")
        config = dict(body.config or {})

    plugin = get_datasource_plugin(str(ds_type))
    cfg = dict(config or {})
    connection, columns, write = plugin.spec.split_write_config_for_validation(
        dict(cfg.get("connection") or {}),
        dict(cfg.get("columns") or {}),
        dict(cfg.get("write") or {}),
    )
    validated = plugin.spec.validate_config(
        {"connection": connection, "columns": columns, "write": write}
    )
    cols = plugin.spec.to_datasource(validated).list_columns()
    str_cols = [str(c) for c in cols]
    columns_meta = dict(validated.get("columns") or {})
    return _build_inspect_columns_response(columns_meta, str_cols)


def get_datasource_dependency_fields(ds_id: str) -> DatasourceDependencyFieldsResponse:
    inst = get_datasource(ds_id)
    if inst is None:
        raise LookupError("数据源不存在")
    fields = inst.list_columns()
    return DatasourceDependencyFieldsResponse(fields=fields)


def get_datasource_public(ds_id: str) -> DataSourcePublic | None:
    row = DataSourceItemsRegistry.get_item(ds_id)
    if row is None:
        return None
    return row_to_public(row)


def create_datasource(body: DataSourceCreate) -> DataSourcePublic:
    _ensure_unique_name(body.name)
    new_row = body.to_row()
    new_row.config = _validate_datasource_storage(
        str(body.type),
        dict(body.connection_config or {}),
        dict(body.columns_config or {}),
        dict(body.write_config or {}),
        datasource_id=new_row.id,
    )
    created_row = DataSourceItemsRegistry.add_item(new_row)
    return row_to_public(created_row)


def patch_datasource(ds_id: str, body: DataSourcePatch) -> DataSourcePublic | None:
    def _apply(row: DataSourceRow) -> None:
        data = body.model_dump(exclude_unset=True)
        if "name" in data:
            _ensure_unique_name(str(data["name"]), exclude_id=ds_id)
            row.name = data["name"]
        if any(k in data for k in ("connection_config", "columns_config", "write_config")):
            plugin = get_datasource_plugin(str(row.type))
            overlay: dict[str, Any] = {}
            if "connection_config" in data:
                overlay["connection"] = dict(data.get("connection_config") or {})
            if "columns_config" in data:
                overlay["columns"] = dict(data.get("columns_config") or {})
            if "write_config" in data:
                overlay["write"] = dict(data.get("write_config") or {})
            merged = plugin.spec.merge_overlay_with_saved_secrets(
                dict(row.config or {}),
                overlay,
            )
            row.config = _validate_datasource_storage(
                str(row.type),
                dict(merged.get("connection") or {}),
                dict(merged.get("columns") or {}),
                dict(merged.get("write") or {}),
                datasource_id=ds_id,
            )
        row.updated_at = utc_now_iso()

    row = DataSourceItemsRegistry.update_item(ds_id, _apply)
    if row is None:
        return None
    return row_to_public(row)


def delete_datasource(ds_id: str) -> bool:
    return DataSourceItemsRegistry.delete_item(ds_id) is not None


def test_datasource(ds_id: str) -> VerifyResult | None:
    rec = DataSourceItemsRegistry.get_item(ds_id)
    if rec is None:
        return None
    plugin = get_datasource_plugin(rec.type)
    plain = plugin.spec.decrypt_storage_config(dict(rec.config or {}))
    try:
        return plugin.spec.to_datasource(plain).verify()
    except Exception as e:
        return VerifyResult(ok=False, message=str(e))
