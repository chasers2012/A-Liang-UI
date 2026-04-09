from __future__ import annotations

import pandas as pd
from factor.datasource import BetweenFilter, FactorDataSource, InFilter, LoadFilter
from sqlalchemy import bindparam, create_engine, inspect, text
from sqlalchemy.engine import Engine


def _as_engine(engine: str | Engine) -> Engine:
    if isinstance(engine, Engine):
        return engine
    return create_engine(engine)


def _quote_ident(engine: Engine, name: str) -> str:
    prep = engine.dialect.identifier_preparer
    if "." in name:
        return ".".join(prep.quote(p) for p in name.split("."))
    return prep.quote(name)


class SqlDataSource(FactorDataSource):
    """从 SQL 表读取普通 DataFrame（中性接口，不承载业务语义）。"""

    def __init__(
        self,
        engine: str | Engine,
        *,
        table: str,
    ) -> None:
        self._engine = _as_engine(engine)
        self._table = str(table)
        self._table_sql = _quote_ident(self._engine, self._table)

    def list_columns(self) -> list[str]:
        insp = inspect(self._engine)
        schema = None
        table = self._table
        if "." in table:
            schema, table = table.split(".", 1)
        cols = [c.get("name") for c in insp.get_columns(table, schema=schema)]
        cols = [str(c) for c in cols if c]
        return sorted(set(cols), key=lambda x: (x.lower(), x))

    def load_frame(
        self,
        *,
        columns: list[str],
        filters: list[LoadFilter] | None = None,
    ) -> pd.DataFrame:
        prep = self._engine.dialect.identifier_preparer

        cols = [str(c) for c in columns]
        if not cols:
            return pd.DataFrame()
        select_parts = []
        for c in cols:
            qc = _quote_ident(self._engine, c)
            select_parts.append(f"{qc} AS {prep.quote(c)}")

        where_parts: list[str] = []
        params: dict = {}
        stmt = None

        if filters:
            codes_needed = False
            for i, flt in enumerate(filters):
                if isinstance(flt, BetweenFilter):
                    col_sql = _quote_ident(self._engine, flt.column)
                    p1 = f"b{i}_s"
                    p2 = f"b{i}_e"
                    where_parts.append(f"{col_sql} >= :{p1} AND {col_sql} <= :{p2}")
                    params[p1] = str(flt.start)
                    params[p2] = str(flt.end)
                elif isinstance(flt, InFilter):
                    col_sql = _quote_ident(self._engine, flt.column)
                    pname = f"in{i}"
                    where_parts.append(f"{col_sql} IN :{pname}")
                    params[pname] = [str(v) for v in (flt.values or [])]
                    codes_needed = True
                else:
                    raise TypeError(f"Unsupported filter: {type(flt)!r}")

            sql = f"SELECT {', '.join(select_parts)} FROM {self._table_sql}"
            if where_parts:
                sql += f" WHERE {' AND '.join(where_parts)}"
            if codes_needed:
                stmt = text(sql)
                for k in [k for k in params if k.startswith("in")]:
                    stmt = stmt.bindparams(bindparam(k, expanding=True))
            else:
                stmt = text(sql)
        else:
            sql = f"SELECT {', '.join(select_parts)} FROM {self._table_sql}"
            stmt = text(sql)

        return pd.read_sql(stmt, self._engine, params=params)
