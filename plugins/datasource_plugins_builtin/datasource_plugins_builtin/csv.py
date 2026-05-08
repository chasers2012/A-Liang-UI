from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from app.datasource.plugins import DataSourcePlugin, VerifyResult
from app.plugin import PluginConfigSchema
from factor.datasource import BetweenFilter, FactorDataSource, InFilter, LoadFilter
from pydantic import BaseModel, Field, model_validator
from workspace import get_workspace_root


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


class CsvConfig(BaseModel):
    path: str
    read_csv_kwargs: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate(self) -> CsvConfig:
        if not str(self.path).strip():
            raise ValueError("path 不能为空")
        return self


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


class CsvDataSourcePlugin(DataSourcePlugin):
    name: Literal["csv"] = "csv"

    config = PluginConfigSchema(
        title="CSV 数据源",
        description="路径可为绝对路径，或相对于 workspace 根目录的相对路径。",
        json_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "title": "文件路径"},
                "read_csv_kwargs": {
                    "type": "object",
                    "title": "read_csv_kwargs（JSON）",
                    "default": {},
                },
            },
            "required": ["path"],
        },
        ui_schema={
            "path": {
                "ui:widget": "file",
                "ui:options": {"accept": ".csv,text/csv"},
                "ui:help": "可填写绝对路径，或相对于 workspace 根目录的相对路径。",
            },
            "read_csv_kwargs": {
                "ui:widget": "textarea",
                "ui:options": {"rows": 6},
                "ui:placeholder": "{}",
            },
        },
    )

    @staticmethod
    def _validate_csv_config(config: dict[str, Any]) -> CsvConfig:
        path = config.get("path")
        if path is None or not str(path).strip():
            raise ValueError("path 不能为空")
        return CsvConfig.model_validate(config)

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = self._validate_csv_config(config)
        return cfg.model_dump(mode="json")

    def to_factor_datasource(self, config: dict[str, Any]):
        cfg = self._validate_csv_config(config)
        return CsvDataSource(path=cfg.path, read_csv_kwargs=dict(cfg.read_csv_kwargs))

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        try:
            cfg = self._validate_csv_config(config)
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))
        p = resolve_csv_path(cfg.path)
        if not p.is_file():
            return VerifyResult(ok=False, message=f"文件不存在: {p}")
        try:
            if not os.access(p, os.R_OK):
                return VerifyResult(ok=False, message=f"文件不可读: {p}")
        except OSError as e:
            return VerifyResult(ok=False, message=f"无法访问路径: {e}")
        return VerifyResult(ok=True, message=f"CSV 可读: {p}")


CSV_PLUGIN = CsvDataSourcePlugin()
