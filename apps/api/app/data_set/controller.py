from __future__ import annotations

from factor.data_set import DataSet, DataSourceBinding

from app.data_set.redistry import DataSetsStore
from app.datasource.controller import get_datasource


def get_data_set(id: str) -> DataSet | None:
    rec = DataSetsStore.get_item(id)
    if rec is None:
        return None

    bindings: list[DataSourceBinding] = []
    for b in rec.datasource_bindings:
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

    start = (rec.start or "").strip() or None
    end = (rec.end or "").strip() or None
    codes = [c.strip() for c in (rec.stock_codes or []) if str(c).strip()]
    return DataSet(
        data_source_bindings=bindings,
        start_date=start,
        end_date=end,
        stock_codes=codes or None,
    )
