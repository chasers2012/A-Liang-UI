from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec, VerifyResult
from app.form import FormSchema
from factor.datasource import FactorDataSource
from pydantic import BaseModel, Field, model_validator
from workspace import get_workspace_root


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


class CsvConnectionConfig(BaseModel):
    """路径与 read_csv 参数（存储 ``connection`` 段）。"""

    path: str
    read_csv_kwargs: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate(self) -> CsvConnectionConfig:
        if not str(self.path).strip():
            raise ValueError("path 不能为空")
        return self


class CsvColumnsConfig(BaseModel):
    """日期列、资产列与列缓存（存储 ``columns`` 段）。"""

    date_column: str = "date"
    asset_column: str | None = "asset"
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> CsvColumnsConfig:
        date_col = str(self.date_column).strip()
        if not date_col:
            raise ValueError("date_column 不能为空")
        self.date_column = date_col
        if self.asset_column is not None:
            asset_col = str(self.asset_column).strip()
            self.asset_column = asset_col or None
        self.columns = [str(c).strip() for c in self.columns if str(c).strip()]
        return self


class CsvDataSource(FactorDataSource):
    """从 CSV 读取普通 DataFrame（中性接口，不承载业务语义）。"""

    def __init__(
        self,
        path: str | Path,
        *,
        read_csv_kwargs: dict | None = None,
        date_column: str = "date",
        asset_column: str | None = "asset",
    ) -> None:
        self._path = Path(path)
        self._read_csv_kwargs = dict(read_csv_kwargs) if read_csv_kwargs else {}
        self._date_column = str(date_column).strip()
        self._asset_column = (
            str(asset_column).strip()
            if asset_column is not None and str(asset_column).strip()
            else None
        )

    @property
    def date_column(self) -> str:
        return self._date_column

    @property
    def asset_column(self) -> str | None:
        return self._asset_column

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
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
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
        mask = pd.Series(True, index=df.index)
        if self._date_column:
            date_column = self._date_column
            if date_column not in df.columns:
                raise ValueError(f"CSV 缺少过滤列: {date_column!r}")
            ser = df[date_column]
            if not (
                pd.api.types.is_datetime64_any_dtype(ser) or pd.api.types.is_datetime64tz_dtype(ser)
            ):
                ser = pd.to_datetime(ser, errors="coerce")
            if start_date is not None:
                mask &= (ser >= pd.Timestamp(start_date)).fillna(False)
            if end_date is not None:
                mask &= (ser <= pd.Timestamp(end_date)).fillna(False)

        if asset_values is not None:
            asset_column = self._asset_column
            if asset_column is None:
                raise ValueError("asset_values 过滤需要 asset_column")
            if asset_column not in df.columns:
                raise ValueError(f"CSV 缺少过滤列: {asset_column!r}")
            values = {str(v) for v in asset_values}
            mask &= df[asset_column].astype(str).isin(values)

        return df.loc[mask].reset_index(drop=True)


class CsvDataSourceSpec(DataSourceSpec):
    def __init__(self) -> None:
        super().__init__(
            connection_schema=FormSchema(
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
            ),
            columns_schema=FormSchema(
                title="CSV 字段配置",
                description="根据连接探测到的列，选择日期列和资产列。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "date_column": {"type": "string", "title": "日期列", "default": "date"},
                        "asset_column": {
                            "type": ["string", "null"],
                            "title": "资产列",
                            "default": "asset",
                        },
                        "columns": {
                            "type": "array",
                            "title": "可选列缓存",
                            "items": {"type": "string"},
                            "default": [],
                        },
                    },
                    "required": ["date_column"],
                },
                ui_schema={
                    "columns": {"ui:widget": "hidden"},
                },
            ),
        )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(config or {})
        conn = CsvConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        col = CsvColumnsConfig.model_validate(dict(raw.get("columns") or {}))
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
        }

    def to_factor_datasource(self, config: dict[str, Any]):
        raw = dict(config or {})
        conn = CsvConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        col = CsvColumnsConfig.model_validate(dict(raw.get("columns") or {}))
        return CsvDataSource(
            path=conn.path,
            read_csv_kwargs=dict(conn.read_csv_kwargs),
            date_column=col.date_column,
            asset_column=col.asset_column,
        )

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        raw = dict(config or {})
        try:
            conn = CsvConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))
        p = resolve_csv_path(conn.path)
        if not p.is_file():
            return VerifyResult(ok=False, message=f"文件不存在: {p}")
        try:
            if not os.access(p, os.R_OK):
                return VerifyResult(ok=False, message=f"文件不可读: {p}")
        except OSError as e:
            return VerifyResult(ok=False, message=f"无法访问路径: {e}")
        return VerifyResult(ok=True, message=f"CSV 可读: {p}")


class CsvDataSourcePlugin(DataSourcePlugin):
    name: Literal["csv"] = "csv"

    spec = CsvDataSourceSpec()


CSV_PLUGIN = CsvDataSourcePlugin()
