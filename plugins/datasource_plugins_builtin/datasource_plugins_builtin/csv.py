from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import duckdb
import pandas as pd
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec, VerifyResult
from app.form import FormSchema
from pydantic import BaseModel, ConfigDict, Field, model_validator
from workspace import get_workspace_root

from ._duckdb_backend import (
    DatasourceColumnsConfig,
    DatasourceWriteConfig,
    DuckDbDataSource,
    duckdb_path,
    quote_literal,
)

_CSV_ENCODING = "utf-8-sig"

_CSV_INITIAL_COLUMNS_SCHEMA: dict = {
    "type": "array",
    "title": "初始列名",
    "items": {"type": "string"},
    "default": ["date", "asset"],
    "description": "创建新文件时写入 CSV 表头；列探测前也可用于字段映射",
}

_CSV_CONNECTION_JSON_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "create_if_missing": {
            "type": "boolean",
            "title": "创建新文件",
            "default": False,
            "description": "勾选后保存时将根据数据源 ID 在 workspace 下自动创建 CSV 文件",
        },
    },
    "dependencies": {
        "create_if_missing": {
            "oneOf": [
                {
                    "properties": {
                        "create_if_missing": {"enum": [True]},
                        "initial_columns": _CSV_INITIAL_COLUMNS_SCHEMA,
                    },
                },
                {
                    "properties": {
                        "create_if_missing": {"enum": [False]},
                        "path": {
                            "type": "string",
                            "title": "CSV 文件",
                            "description": "上传已有 CSV 文件",
                        },
                    },
                    "required": ["path"],
                },
            ],
        },
    },
}

_CSV_CONNECTION_UI_SCHEMA: dict = {
    "ui:order": ["create_if_missing", "path", "initial_columns"],
    "path": {
        "ui:widget": "file",
        "ui:options": {"accept": ".csv,text/csv"},
    },
    "initial_columns": {
        "ui:options": {"orderable": True, "addable": True, "removable": True},
    },
}


def csv_path_for_datasource_id(datasource_id: str) -> str:
    ds_id = str(datasource_id).strip()
    if not ds_id:
        raise ValueError("datasource_id 不能为空")
    return f"data/datasources/{ds_id}.csv"


def _normalize_connection_form_raw(connection: dict[str, Any]) -> dict[str, Any]:
    raw = dict(connection or {})
    create = bool(raw.get("create_if_missing"))
    stored: dict[str, Any] = {
        "create_if_missing": create,
        "path": str(raw.get("path") or "").strip(),
    }
    if create:
        stored["initial_columns"] = raw.get("initial_columns") or ["date", "asset"]
    return stored


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


def _unique_column_names(values: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values or []:
        name = str(raw).strip()
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def _header_columns_for_new_file(
    *,
    initial_columns: list[str],
    date_column: str,
    asset_column: str | None,
    cached_columns: list[str],
) -> list[str]:
    for source in (_unique_column_names(cached_columns), _unique_column_names(initial_columns)):
        if source:
            return source
    cols = [date_column]
    if asset_column and asset_column not in cols:
        cols.append(asset_column)
    if not cols[0]:
        raise ValueError("创建新 CSV 需要至少一列，请填写 initial_columns 或 date_column")
    return cols


def ensure_csv_file(path: Path, *, columns: list[str]) -> None:
    if path.is_file() and path.stat().st_size > 0:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(columns=columns).to_csv(path, index=False, encoding=_CSV_ENCODING)


class CsvWriteConfig(DatasourceWriteConfig):
    pass


class CsvConnectionConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    path: str = ""
    create_if_missing: bool = False
    initial_columns: list[str] = Field(default_factory=lambda: ["date", "asset"])

    @model_validator(mode="after")
    def _validate(self) -> CsvConnectionConfig:
        self.path = str(self.path).strip()
        if self.create_if_missing:
            if self.path and not self.path.lower().endswith(".csv"):
                raise ValueError("CSV 路径须以 .csv 结尾")
        elif not self.path:
            raise ValueError("path 不能为空")
        self.initial_columns = _unique_column_names(self.initial_columns)
        return self


class CsvColumnsConfig(DatasourceColumnsConfig):
    pass


class CsvDataSource(DuckDbDataSource):
    def __init__(
        self,
        path: str | Path,
        *,
        date_column: str = "date",
        asset_column: str | None = "asset",
        write_enabled: bool = False,
        create_if_missing: bool = False,
        initial_columns: list[str] | None = None,
        cached_columns: list[str] | None = None,
    ) -> None:
        super().__init__(
            date_column=date_column,
            asset_column=asset_column,
            write_enabled=write_enabled,
        )
        self._path_str = str(path).strip()
        self._file = resolve_csv_path(self._path_str)
        self._create_if_missing = bool(create_if_missing)
        self._initial_columns = _unique_column_names(initial_columns)
        self._cached_columns = _unique_column_names(cached_columns)
        self._rel = f"read_csv_auto({quote_literal(duckdb_path(self._file))}, header=true)"

    def _header_columns(self) -> list[str]:
        return _header_columns_for_new_file(
            initial_columns=self._initial_columns,
            date_column=self._date_column,
            asset_column=self._asset_column,
            cached_columns=self._cached_columns,
        )

    def _prepare(self, con: duckdb.DuckDBPyConnection) -> None:
        if self._file.is_file() and self._file.stat().st_size > 0:
            return
        if not self._create_if_missing:
            raise ValueError(f"CSV 文件不存在: {self._file}")
        ensure_csv_file(self._file, columns=self._header_columns())

    def list_columns(self) -> list[str]:
        if not self._file.is_file() or self._file.stat().st_size == 0:
            if self._create_if_missing:
                return sorted(set(self._header_columns()), key=lambda x: (x.lower(), x))
            raise ValueError(f"CSV 文件不存在: {self._file}")
        return super().list_columns()

    def _persist_new_rows(
        self,
        con: duckdb.DuckDBPyConnection,
        new_rows_view: str,
        incoming_columns: list[str],
        new_row_count: int,
    ) -> int:
        self._file.parent.mkdir(parents=True, exist_ok=True)
        file_exists = self._file.is_file() and self._file.stat().st_size > 0

        if file_exists:
            existing_cols = [
                str(r[0])
                for r in con.execute(f"DESCRIBE SELECT * FROM {self._rel}").fetchall()
                if r and r[0] is not None
            ]
            missing = sorted(set(existing_cols) - set(incoming_columns))
            if missing:
                raise ValueError(f"同步结果缺少目标 CSV 已有列: {missing}")
            extra = sorted(set(incoming_columns) - set(existing_cols))
            if extra:
                raise ValueError(f"同步结果包含目标 CSV 中不存在的列: {extra}")
            body = f"SELECT * FROM {self._rel} UNION ALL BY NAME SELECT * FROM {new_rows_view}"
        else:
            body = f"SELECT * FROM {new_rows_view}"

        tmp_path = self._file.with_suffix(self._file.suffix + ".tmp")
        if tmp_path.exists():
            tmp_path.unlink()
        con.execute(
            f"COPY ({body}) TO {quote_literal(duckdb_path(tmp_path))} (FORMAT CSV, HEADER true)"
        )
        os.replace(tmp_path, self._file)
        return new_row_count

    @staticmethod
    def _access_error(path: Path, mode: str) -> VerifyResult | None:
        flag = os.R_OK if "r" in mode else 0
        flag |= os.W_OK if "w" in mode else 0
        try:
            if path.exists() and not os.access(path, flag):
                label = "不可读" if mode == "r" else "不可写" if mode == "w" else "不可读写"
                return VerifyResult(ok=False, message=f"文件{label}: {path}")
        except OSError as e:
            return VerifyResult(ok=False, message=f"无法访问路径: {e}")
        return None

    def verify(self) -> VerifyResult:
        if self._create_if_missing:
            if not self._path_str:
                return VerifyResult(
                    ok=True,
                    message="保存后将根据数据源 ID 自动创建 CSV（data/datasources/<id>.csv）",
                )
            if self._file.is_file():
                return VerifyResult(ok=True, message=f"CSV 可读: {self._file}")
            try:
                if self._file.parent.exists() and not os.access(self._file.parent, os.W_OK):
                    return VerifyResult(ok=False, message=f"目录不可写: {self._file.parent}")
            except OSError as e:
                return VerifyResult(ok=False, message=f"无法访问路径: {e}")
            return VerifyResult(ok=True, message=f"将创建 CSV: {self._file}")

        if not self._file.is_file():
            return VerifyResult(ok=False, message=f"文件不存在: {self._file}")
        mode = "rw" if self._write_enabled else "r"
        err = self._access_error(self._file, mode)
        if err is not None:
            return err
        if self._write_enabled:
            return VerifyResult(ok=True, message=f"CSV 可读写: {self._file}")
        return VerifyResult(ok=True, message=f"CSV 可读: {self._file}")


def _parse_csv_config(
    raw: dict[str, Any],
) -> tuple[CsvConnectionConfig, CsvColumnsConfig, CsvWriteConfig]:
    return (
        CsvConnectionConfig.model_validate(
            _normalize_connection_form_raw(dict(raw.get("connection") or {}))
        ),
        CsvColumnsConfig.model_validate(dict(raw.get("columns") or {})),
        CsvWriteConfig.model_validate(dict(raw.get("write") or {})),
    )


class CsvDataSourceSpec(DataSourceSpec):
    def __init__(self) -> None:
        super().__init__(
            connection_schema=FormSchema(
                title="CSV 数据源",
                description="路径可为绝对路径，或相对于 workspace 根目录的相对路径。",
                json_schema=_CSV_CONNECTION_JSON_SCHEMA,
                ui_schema=_CSV_CONNECTION_UI_SCHEMA,
            ),
            write_schema=FormSchema(
                title="CSV 数据写入",
                description="配置是否允许数据同步任务向该 CSV 追加写入。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "write_enabled": {
                            "type": "boolean",
                            "title": "允许写入",
                            "default": False,
                            "description": "勾选后该数据源可作为数据同步的目标数据源",
                        },
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
                ui_schema={"columns": {"ui:widget": "hidden"}},
            ),
        )

    def prepare_storage_config(
        self,
        datasource_id: str,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        raw = dict(config or {})
        conn = dict(raw.get("connection") or {})
        if conn.get("create_if_missing") and not str(conn.get("path") or "").strip():
            raw["connection"] = {**conn, "path": csv_path_for_datasource_id(datasource_id)}
        return raw

    def encrypt_storage_config(self, storage_config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(storage_config or {})
        conn = _normalize_connection_form_raw(dict(raw.get("connection") or {}))
        return super().encrypt_storage_config({**raw, "connection": conn})

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        conn, col, write = _parse_csv_config(dict(config or {}))
        if conn.create_if_missing and conn.path:
            ensure_csv_file(
                resolve_csv_path(conn.path),
                columns=_header_columns_for_new_file(
                    initial_columns=conn.initial_columns,
                    date_column=col.date_column,
                    asset_column=col.asset_column,
                    cached_columns=col.columns,
                ),
            )
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
            "write": write.model_dump(mode="json"),
        }

    def to_datasource(self, config: dict[str, Any]):
        conn, col, write = _parse_csv_config(dict(config or {}))
        return CsvDataSource(
            path=conn.path,
            date_column=col.date_column,
            asset_column=col.asset_column,
            write_enabled=write.write_enabled,
            create_if_missing=conn.create_if_missing,
            initial_columns=conn.initial_columns,
            cached_columns=col.columns,
        )

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        try:
            return self.to_datasource(config).verify()
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))


class CsvDataSourcePlugin(DataSourcePlugin):
    name: Literal["csv"] = "csv"
    spec = CsvDataSourceSpec()


__all__ = ["CsvDataSourcePlugin"]
