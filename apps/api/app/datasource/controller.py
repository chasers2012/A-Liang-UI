from __future__ import annotations

from typing import Any

from factor import FactorDataSource

from app.datasource.models import DataSourceRow
from app.datasource.plugins import get_datasource_plugin, merge_datasource_config_schemas
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import (
    DataSourceCreate,
    DatasourceDependencyFieldsResponse,
    DataSourcePatch,
    DatasourcePluginPublic,
    DataSourcePublic,
    InspectColumnsRequest,
    InspectColumnsResponse,
    VerifyResult,
    row_to_public,
    utc_now_iso,
)
from app.plugin import PluginRegistry
from app.secret.secret_fields import decrypt_fields, encrypt_fields


def _normalize_name(name: str) -> str:
    return str(name).strip()


def _client_sent_unchanged_secret(val: Any) -> bool:
    """True when the client did not supply a new secret (redacted, empty, or omitted meaning)."""

    return val is None or (isinstance(val, str) and str(val).strip() in ("", "***"))


def _merge_config_overlay_with_saved_secrets(
    saved: dict[str, Any],
    overlay: dict[str, Any],
    ds_type: str,
) -> dict[str, Any]:
    """
    Apply ``overlay`` on top of ``saved``, but keep stored values for fields listed as
    secret fields on the merged form schema (``secret_keys`` / password widgets)
    when the client sends placeholders (API redaction ``***`` or blank = keep password).
    """

    schema = None
    secret_keys: frozenset[str] = frozenset()
    try:
        plugin = get_datasource_plugin(str(ds_type))
        schema = merge_datasource_config_schemas(
            plugin.spec.get_connection_config_schema(),
            plugin.spec.get_columns_config_schema(),
        )
        secret_keys = frozenset(schema.resolved_secret_keys() if schema else [])
    except Exception:
        schema = None
        secret_keys = frozenset()

    # decrypt saved secrets so internal validation/inspection works with plaintext
    merged = decrypt_fields(dict(saved), schema.resolved_secret_keys() if schema else None)
    for key, val in overlay.items():
        sk = str(key)
        if sk in secret_keys and _client_sent_unchanged_secret(val):
            continue
        merged[sk] = val
    return merged


def _schema_for_type(ds_type: str) -> Any:  # FormSchema | None
    try:
        plugin = get_datasource_plugin(str(ds_type))
        return merge_datasource_config_schemas(
            plugin.spec.get_connection_config_schema(),
            plugin.spec.get_columns_config_schema(),
        )
    except Exception:
        return None


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


class BoundFactorDataSource(FactorDataSource):
    """Attach datasource id for downstream cross-source preprocessing."""

    def __init__(self, datasource_id: str, inner: FactorDataSource) -> None:
        self.id = str(datasource_id)
        self._inner = inner

    def list_columns(self) -> list[str]:
        return self._inner.list_columns()

    @property
    def date_column(self) -> str:
        return self._inner.date_column

    @property
    def asset_column(self) -> str | None:
        return self._inner.asset_column

    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ):  # type: ignore[no-untyped-def]
        return self._inner.load_frame(
            columns=columns,
            start_date=start_date,
            end_date=end_date,
            asset_values=asset_values,
        )


def get_datasource(id: str) -> FactorDataSource | None:
    rec = DataSourceItemsRegistry.get_item(id)
    if rec is None:
        return None
    plugin = get_datasource_plugin(rec.type)
    schema = _schema_for_type(str(rec.type))
    plain = decrypt_fields(
        dict(rec.config or {}), schema.resolved_secret_keys() if schema else None
    )
    ds = plugin.spec.to_factor_datasource(plain)
    return BoundFactorDataSource(id, ds)


def list_datasources() -> list[DataSourcePublic]:
    return [row_to_public(i) for i in DataSourceItemsRegistry.list_items()]


def list_datasource_plugins() -> list[DatasourcePluginPublic]:
    reg = PluginRegistry.instance()
    out: list[DatasourcePluginPublic] = []
    for ds_type, plugin in reg.list_registered_by_category("datasource"):
        connection_schema = plugin.spec.get_connection_config_schema()
        columns_schema = plugin.spec.get_columns_config_schema()
        title = (
            (connection_schema.title if connection_schema else None)
            or (columns_schema.title if columns_schema else None)
            or str(ds_type).upper()
        )
        description = (connection_schema.description if connection_schema else None) or (
            columns_schema.description if columns_schema else None
        )
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
        saved = dict(rec.config or {})
        if body.config is not None:
            config = _merge_config_overlay_with_saved_secrets(saved, dict(body.config), ds_type)
        else:
            config = saved
    else:
        if not ds_type:
            raise ValueError("type is required when datasource_id is not provided")
        config = dict(body.config or {})

    plugin = get_datasource_plugin(str(ds_type))
    validated = plugin.spec.validate_config(config)
    if not hasattr(plugin, "list_table_columns"):
        raise ValueError(f"该数据源类型不支持列探测: {ds_type!r}")
    cols = plugin.list_table_columns(validated)
    str_cols = [str(c) for c in cols]
    return _build_inspect_columns_response(validated, str_cols)


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
    plugin = get_datasource_plugin(str(body.type))
    schema = _schema_for_type(str(body.type))
    validated = plugin.spec.validate_config(dict(body.config or {}))
    new_row = body.to_row()
    new_row.config = encrypt_fields(validated, schema.resolved_secret_keys() if schema else None)
    created_row = DataSourceItemsRegistry.add_item(new_row)
    return row_to_public(created_row)


def patch_datasource(ds_id: str, body: DataSourcePatch) -> DataSourcePublic | None:
    def _apply(row: DataSourceRow) -> None:
        data = body.model_dump(exclude_unset=True)
        if "name" in data:
            _ensure_unique_name(str(data["name"]), exclude_id=ds_id)
            row.name = data["name"]
        if "config" in data:
            plugin = get_datasource_plugin(str(row.type))
            schema = _schema_for_type(str(row.type))
            merged = _merge_config_overlay_with_saved_secrets(
                dict(row.config or {}),
                dict(data["config"] or {}),
                str(row.type),
            )
            validated = plugin.spec.validate_config(merged)
            row.config = encrypt_fields(
                validated, schema.resolved_secret_keys() if schema else None
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
    schema = merge_datasource_config_schemas(
        plugin.spec.get_connection_config_schema(),
        plugin.spec.get_columns_config_schema(),
    )
    plain = decrypt_fields(
        dict(rec.config or {}), schema.resolved_secret_keys() if schema else None
    )
    return plugin.spec.verify(plain)
