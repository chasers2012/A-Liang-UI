from __future__ import annotations

from pathlib import Path

import pandas as pd
from factor.datasource import BetweenFilter, FactorDataSource, InFilter, LoadFilter
from workspace import get_workspace_root


class CsvDataSource(FactorDataSource):
    """从 CSV 读取普通 DataFrame（中性接口，不承载业务语义）。"""

    def __init__(
        self,
        path: str | Path,
        *,
        read_csv_kwargs: dict | None = None,
    ) -> None:
        self._path = Path(path)
        self._read_csv_kwargs = dict(read_csv_kwargs) if read_csv_kwargs else {}

    def _resolved_file_path(self) -> Path:
        """Workspace-relative paths resolve under :func:`get_workspace_root`."""
        if self._path.is_absolute():
            return self._path.resolve()
        return (get_workspace_root() / self._path).resolve()

    def _read_csv_kwargs_effective(self) -> dict:
        kw: dict = {"encoding": "utf-8-sig"}
        kw.update(self._read_csv_kwargs)
        return kw

    def list_columns(self) -> list[str]:
        path = self._resolved_file_path()
        if not path.is_file():
            raise ValueError(f"CSV 文件不存在: {path}")
        read_kw = self._read_csv_kwargs_effective()
        peek_kw = {k: v for k, v in read_kw.items() if k != "usecols"}
        header = pd.read_csv(path, nrows=0, **peek_kw)
        cols = [str(c) for c in header.columns]
        return sorted(set(cols), key=lambda x: (x.lower(), x))

    def load_frame(
        self,
        *,
        columns: list[str],
        filters: list[LoadFilter] | None = None,
    ) -> pd.DataFrame:
        read_kw = self._read_csv_kwargs_effective()
        usecols = sorted({str(c) for c in columns})
        peek_kw = {k: v for k, v in read_kw.items() if k != "usecols"}
        header = pd.read_csv(self._resolved_file_path(), nrows=0, **peek_kw)
        present = set(header.columns)
        missing = sorted(set(usecols) - present)
        if missing:
            raise ValueError(
                f"CSV 缺少所需列. Missing in file: {missing}. Columns present: {sorted(present)}."
            )
        df = pd.read_csv(
            self._resolved_file_path(),
            usecols=usecols,
            **read_kw,
        )
        if not filters:
            return df

        mask = pd.Series(True, index=df.index)
        for flt in filters:
            if isinstance(flt, BetweenFilter):
                if flt.column not in df.columns:
                    raise ValueError(f"CSV 缺少过滤列: {flt.column!r}")
                s = df[flt.column]
                if pd.api.types.is_datetime64_any_dtype(s) or pd.api.types.is_datetime64tz_dtype(s):
                    ser = s
                    start = pd.Timestamp(flt.start)
                    end = pd.Timestamp(flt.end)
                else:
                    ser = pd.to_datetime(s, errors="coerce")
                    start = pd.Timestamp(flt.start)
                    end = pd.Timestamp(flt.end)
                m = (ser >= start) & (ser <= end)
                mask &= m.fillna(False)
            elif isinstance(flt, InFilter):
                if flt.column not in df.columns:
                    raise ValueError(f"CSV 缺少过滤列: {flt.column!r}")
                values = {str(v) for v in (flt.values or [])}
                mask &= df[flt.column].astype(str).isin(values)
            else:
                raise TypeError(f"Unsupported filter: {type(flt)!r}")

        return df.loc[mask].reset_index(drop=True)
