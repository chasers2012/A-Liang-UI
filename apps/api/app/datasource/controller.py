from __future__ import annotations

from factor import FactorDataSource

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
    TestResult,
    row_to_public,
    utc_now_iso,
)
from app.datasource.verify import verify_datasource
from app.plugin import PluginRegistry


def _normalize_name(name: str) -> str:
    return str(name).strip()


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

    def load_frame(
        self,
        *,
        columns: list[str],
        date_column: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        asset_column: str | None = None,
        asset_values: list[str] | None = None,
    ):  # type: ignore[no-untyped-def]
        return self._inner.load_frame(
            columns=columns,
            date_column=date_column,
            start_date=start_date,
            end_date=end_date,
            asset_column=asset_column,
            asset_values=asset_values,
        )


def get_datasource(id: str) -> FactorDataSource | None:
    rec = DataSourceItemsRegistry.get_item(id)
    if rec is None:
        return None
    plugin = get_datasource_plugin(rec.type)
    ds = plugin.to_factor_datasource(dict(rec.config or {}))
    return BoundFactorDataSource(id, ds)


def list_datasources() -> list[DataSourcePublic]:
    return [row_to_public(i) for i in DataSourceItemsRegistry.list_items()]


def list_datasource_plugins() -> list[DatasourcePluginPublic]:
    reg = PluginRegistry.instance()
    out: list[DatasourcePluginPublic] = []
    for ds_type, plugin in reg.list_registered_by_category("datasource"):
        schema = plugin.get_config_schema()
        out.append(
            DatasourcePluginPublic(
                type=ds_type,
                title=schema.title if schema else ds_type.upper(),
                description=schema.description if schema else None,
                json_schema=dict(schema.json_schema or {}) if schema else {},
                ui_schema=dict(schema.ui_schema or {}) if schema else {},
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
        config = dict(rec.config or {})
        if body.config is not None:
            config = dict(body.config)
    else:
        if not ds_type:
            raise ValueError("type is required when datasource_id is not provided")
        config = dict(body.config or {})

    plugin = get_datasource_plugin(str(ds_type))
    validated = plugin.validate_config(config)
    if not hasattr(plugin, "list_table_columns"):
        raise ValueError(f"该数据源类型不支持列探测: {ds_type!r}")
    cols = plugin.list_table_columns(validated)
    return InspectColumnsResponse(columns=[str(c) for c in cols])


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
    validated = plugin.validate_config(dict(body.config or {}))
    new_row = body.to_row()
    new_row.config = validated
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
            row.config = plugin.validate_config(dict(data["config"] or {}))
        row.updated_at = utc_now_iso()

    row = DataSourceItemsRegistry.update_item(ds_id, _apply)
    if row is None:
        return None
    return row_to_public(row)


def delete_datasource(ds_id: str) -> bool:
    return DataSourceItemsRegistry.delete_item(ds_id) is not None


def test_datasource(ds_id: str) -> TestResult | None:
    rec = DataSourceItemsRegistry.get_item(ds_id)
    if rec is None:
        return None
    ok, msg = verify_datasource(rec)
    return TestResult(ok=ok, message=msg)
