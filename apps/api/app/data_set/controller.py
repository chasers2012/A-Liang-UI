from __future__ import annotations

from evaluate.data_set import DataSet, DataSourceBinding

from app.data_set.redistry import DataSetsStore
from app.datasources.controller import get_datasource


def get_data_set(id: str) -> DataSet | None:
    rec = DataSetsStore.get_item(id)
    if rec is None:
        return None
    return DataSet(
        data_source_bindings=[
            DataSourceBinding(
                datasource=get_datasource(binding.datasource_id),
                dependencies=binding.dependencies,
                alias=binding.alias,
            )
            for binding in rec.datasource_bindings
        ]
    )
