from __future__ import annotations

from factor.data_set import DataSet, DataSourceBinding

from app.data_set.redistry import DataSetsStore
from app.datasource.controller import get_datasource
from app.datasource.registry import DataSourceItemsRegistry


def get_data_set(id: str) -> DataSet | None:
    rec = DataSetsStore.get_item(id)
    if rec is None:
        return None

    bindings: list[DataSourceBinding] = []
    for b in rec.datasource_bindings:
        ds = get_datasource(b.datasource_id)
        if ds is None:
            continue
        ds_rec = DataSourceItemsRegistry.get_item(b.datasource_id)
        if ds_rec is None:
            continue

        # 兼容旧持久化：date/asset/column_map 仍存于 datasource 记录中，这里下沉到 binding
        if ds_rec.type == "csv" and ds_rec.csv is not None:
            date_col = ds_rec.csv.date_column
            asset_col = ds_rec.csv.asset_column
            alias = b.alias
        elif ds_rec.type == "sql" and ds_rec.sql is not None:
            date_col = ds_rec.sql.date_column
            asset_col = ds_rec.sql.asset_column
            alias = b.alias if b.alias is not None else dict(ds_rec.sql.column_map or {})
        else:
            raise ValueError(f"Unknown datasource record type: {ds_rec.type}")

        bindings.append(
            DataSourceBinding(
                datasource=ds,
                dependencies=b.dependencies,
                alias=alias,
                date_column=date_col,
                asset_column=asset_col,
            )
        )

    return DataSet(data_source_bindings=bindings)
