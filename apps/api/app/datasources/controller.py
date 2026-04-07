from __future__ import annotations

from pathlib import Path

from csv_datasource import CsvDataSource
from factor import FactorDataSource
from sql_datasource import SqlDataSource
from workspace import get_workspace_root

from app.datasources.registry import DataSourceItemsRegistry
from app.datasources.sql_url import build_sqlalchemy_url


def get_datasource(id: str) -> FactorDataSource | None:
    rec = DataSourceItemsRegistry.get_item(id)
    if rec is None:
        return None
    if rec.type == "sql":
        if rec.sql is None:
            raise ValueError("sql config missing for data source type=sql")
        url = build_sqlalchemy_url(rec.sql)
        if not url:
            raise ValueError("sql config incomplete: need db_host and db_name")
        return SqlDataSource(
            engine=url,
            table=rec.sql.table,
            date_column=rec.sql.date_column,
            asset_column=rec.sql.asset_column,
            column_map=rec.sql.column_map,
        )
    if rec.type == "csv":
        return CsvDataSource(
            path=rec.csv.path,
            date_column=rec.csv.date_column,
            asset_column=rec.csv.asset_column,
            read_csv_kwargs=rec.csv.read_csv_kwargs,
        )
    raise ValueError(f"Unknown data source type: {rec.type}")


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()
