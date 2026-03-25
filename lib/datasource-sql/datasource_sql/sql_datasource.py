from __future__ import annotations

from typing import List, Mapping, Optional, Union

import pandas as pd
from factor.datasource import FactorDataSource
from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import Engine


def _as_engine(engine: Union[str, Engine]) -> Engine:
    if isinstance(engine, Engine):
        return engine
    return create_engine(engine)


def _quote_ident(engine: Engine, name: str) -> str:
    prep = engine.dialect.identifier_preparer
    if "." in name:
        return ".".join(prep.quote(p) for p in name.split("."))
    return prep.quote(name)


def _panel_load_start(
    start_date: Optional[str], end_date: str, window: int
) -> pd.Timestamp:
    """
    Earliest calendar date to load so rolling windows up to ``window``
    business days can be satisfied before the first requested bar.
    """
    end_ts = pd.Timestamp(end_date).normalize()
    w = max(int(window), 0)
    if start_date:
        s = pd.Timestamp(start_date).normalize()
        if w == 0:
            return s
        return (s - pd.offsets.BDay(w)).normalize()
    if w == 0:
        return end_ts
    return (end_ts - pd.offsets.BDay(w + 1)).normalize()


class SqlFactorDataSource(FactorDataSource):
    """
    Load a long-format SQL table into a MultiIndex (date, asset) panel.

    Expects one row per (date, asset). Map factor dependency names to DB
    columns via ``column_map`` when they differ.

    Depends on :class:`factor.datasource.FactorDataSource` and SQLAlchemy.
    """

    def __init__(
        self,
        engine: Union[str, Engine],
        *,
        table: str,
        date_column: str,
        asset_column: str,
        column_map: Optional[Mapping[str, str]] = None,
    ) -> None:
        self._engine = _as_engine(engine)
        self._table_sql = _quote_ident(self._engine, table)
        self._date_sql = _quote_ident(self._engine, date_column)
        self._asset_sql = _quote_ident(self._engine, asset_column)
        self._column_map = dict(column_map) if column_map else {}

    def get_panel(
        self,
        *,
        fields: List[str],
        start_date: Optional[str],
        end_date: str,
        stock_codes: Optional[List[str]],
        window: int,
    ) -> pd.DataFrame:
        load_start = _panel_load_start(start_date, end_date, window)
        end_ts = pd.Timestamp(end_date).normalize()
        prep = self._engine.dialect.identifier_preparer

        select_parts = [
            f"{self._date_sql} AS {prep.quote('date')}",
            f"{self._asset_sql} AS {prep.quote('asset')}",
        ]
        for f in fields:
            db_col = self._column_map.get(f, f)
            qc = _quote_ident(self._engine, db_col)
            qf = prep.quote(f)
            select_parts.append(f"{qc} AS {qf}")

        sql = (
            f"SELECT {', '.join(select_parts)} "
            f"FROM {self._table_sql} "
            f"WHERE {self._date_sql} >= :load_start AND {self._date_sql} <= :end_date"
        )
        params: dict = {
            "load_start": load_start.strftime("%Y-%m-%d"),
            "end_date": end_ts.strftime("%Y-%m-%d"),
        }

        if stock_codes:
            sql += f" AND {self._asset_sql} IN :codes"
            params["codes"] = list(stock_codes)

        sql += f" ORDER BY {self._date_sql}, {self._asset_sql}"

        if stock_codes:
            stmt = text(sql).bindparams(bindparam("codes", expanding=True))
        else:
            stmt = text(sql)

        df = pd.read_sql(stmt, self._engine, params=params)
        if df.empty:
            empty_idx = pd.MultiIndex.from_arrays(
                [[], []], names=["date", "asset"]
            )
            return pd.DataFrame(columns=fields, index=empty_idx)

        df["date"] = pd.to_datetime(df["date"])
        df["asset"] = df["asset"].astype(str)
        df = df.set_index(["date", "asset"]).sort_index()
        return df
