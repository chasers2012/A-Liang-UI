from __future__ import annotations

from pathlib import Path

import pandas as pd
from factor.datasource import FactorDataSource


class CsvDataSource(FactorDataSource):
    """
    Load a long-format CSV into a MultiIndex (date, asset) panel.

    Expects one row per (date, asset). Column names in the file must match the
    ``fields`` passed to :meth:`get_panel` (after date/asset renaming to index).
    To map logical factor fields to different CSV headers, use
    :class:`factor.DependencyResolver` ``alias`` when registering this source.

    ``start_date`` / ``end_date`` are inclusive bounds; include any lookback history
    in ``start_date`` (e.g. via :func:`factor.panel_load_start_date`).
    """

    def __init__(
        self,
        path: str | Path,
        *,
        date_column: str,
        asset_column: str,
        read_csv_kwargs: dict | None = None,
    ) -> None:
        self._path = Path(path)
        self._date_column = date_column
        self._asset_column = asset_column
        self._read_csv_kwargs = dict(read_csv_kwargs) if read_csv_kwargs else {}

    def _read_csv_kwargs_effective(self) -> dict:
        kw: dict = {"encoding": "utf-8-sig"}
        kw.update(self._read_csv_kwargs)
        return kw

    def get_panel(
        self,
        *,
        fields: list[str],
        start_date: str,
        end_date: str,
        stock_codes: list[str] | None,
    ) -> pd.DataFrame:
        load_start = pd.Timestamp(start_date).normalize()
        end_ts = pd.Timestamp(end_date).normalize()

        usecols = {self._date_column, self._asset_column}
        for f in fields:
            usecols.add(f)
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
        df = df.rename(
            columns={
                self._date_column: "date",
                self._asset_column: "asset",
            }
        )

        df["date"] = pd.to_datetime(df["date"])
        df["asset"] = df["asset"].astype(str)

        mask = (df["date"] >= load_start) & (df["date"] <= end_ts)
        if stock_codes is not None:
            codes = {str(c) for c in stock_codes}
            mask &= df["asset"].isin(codes)
        df = df.loc[mask, ["date", "asset", *fields]]

        if df.empty:
            empty_idx = pd.MultiIndex.from_arrays([[], []], names=["date", "asset"])
            return pd.DataFrame(columns=fields, index=empty_idx)

        return df.set_index(["date", "asset"]).sort_index()
