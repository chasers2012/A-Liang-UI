from __future__ import annotations

from pathlib import Path
from typing import List, Mapping, Optional, Union

import pandas as pd
from factor.datasource import FactorDataSource


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


class CsvFactorDataSource(FactorDataSource):
    """
    Load a long-format CSV into a MultiIndex (date, asset) panel.

    Expects one row per (date, asset). Map factor dependency names to file
    columns via ``column_map`` when they differ.
    """

    def __init__(
        self,
        path: Union[str, Path],
        *,
        date_column: str,
        asset_column: str,
        column_map: Optional[Mapping[str, str]] = None,
        read_csv_kwargs: Optional[dict] = None,
    ) -> None:
        self._path = Path(path)
        self._date_column = date_column
        self._asset_column = asset_column
        self._column_map = dict(column_map) if column_map else {}
        self._read_csv_kwargs = dict(read_csv_kwargs) if read_csv_kwargs else {}

    def _read_csv_kwargs_effective(self) -> dict:
        kw: dict = {"encoding": "utf-8-sig"}
        kw.update(self._read_csv_kwargs)
        return kw

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

        usecols = {self._date_column, self._asset_column}
        for f in fields:
            usecols.add(self._column_map.get(f, f))
        read_kw = self._read_csv_kwargs_effective()
        peek_kw = {k: v for k, v in read_kw.items() if k != "usecols"}
        header = pd.read_csv(self._path, nrows=0, **peek_kw)
        present = set(header.columns)
        needed = set(usecols)
        missing = sorted(needed - present)
        if missing:
            raise ValueError(
                "CSV column names do not match the configured date/asset/field "
                f"columns. Missing in file: {missing}. "
                f"Columns present: {sorted(present)}."
            )
        df = pd.read_csv(
            self._path,
            usecols=sorted(usecols),
            **read_kw,
        )
        rename = {
            self._date_column: "date",
            self._asset_column: "asset",
        }
        for f in fields:
            src = self._column_map.get(f, f)
            if src != f:
                rename[src] = f
        df = df.rename(columns=rename)

        df["date"] = pd.to_datetime(df["date"])
        df["asset"] = df["asset"].astype(str)

        mask = (df["date"] >= load_start) & (df["date"] <= end_ts)
        if stock_codes is not None:
            codes = set(str(c) for c in stock_codes)
            mask &= df["asset"].isin(codes)
        df = df.loc[mask, ["date", "asset", *fields]]

        if df.empty:
            empty_idx = pd.MultiIndex.from_arrays(
                [[], []], names=["date", "asset"]
            )
            return pd.DataFrame(columns=fields, index=empty_idx)

        df = df.set_index(["date", "asset"]).sort_index()
        return df
