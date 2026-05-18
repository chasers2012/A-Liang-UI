from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec, VerifyResult
from app.form import FormSchema
from data_source import DataSource
from pydantic import BaseModel, ConfigDict, Field, model_validator
from workspace import get_workspace_root

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
    """将表单 connection 规范为存储形态（``path`` + ``create_if_missing`` [+ ``initial_columns``]）。"""
    raw = dict(connection or {})
    create = bool(raw.get("create_if_missing"))
    path_str = str(raw.get("path") or "").strip()
    stored: dict[str, Any] = {
        "create_if_missing": create,
        "path": path_str,
    }
    if create:
        stored["initial_columns"] = raw.get("initial_columns") or ["date", "asset"]
    return stored


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


def _normalize_column_names(values: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values or []:
        name = str(raw).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(name)
    return out


def _columns_for_new_csv_file(
    *,
    initial_columns: list[str],
    date_column: str,
    asset_column: str | None,
    cached_columns: list[str],
) -> list[str]:
    cols = _normalize_column_names(cached_columns)
    if cols:
        return cols
    cols = _normalize_column_names(initial_columns)
    if cols:
        return cols
    cols = [str(date_column).strip()]
    if asset_column and str(asset_column).strip():
        ac = str(asset_column).strip()
        if ac not in cols:
            cols.append(ac)
    if not cols or not cols[0]:
        raise ValueError("创建新 CSV 需要至少一列，请填写 initial_columns 或 date_column")
    return cols


def ensure_csv_file(
    path: Path,
    *,
    columns: list[str],
) -> None:
    if path.is_file() and path.stat().st_size > 0:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(columns=columns).to_csv(path, index=False, encoding=_CSV_ENCODING)


def _verify_parent_writable(parent: Path) -> VerifyResult | None:
    try:
        if parent.exists() and not os.access(parent, os.W_OK):
            return VerifyResult(ok=False, message=f"目录不可写: {parent}")
    except OSError as e:
        return VerifyResult(ok=False, message=f"无法访问路径: {e}")
    return None


def _verify_csv_create_if_missing(conn: CsvConnectionConfig) -> VerifyResult:
    path_str = str(conn.path or "").strip()
    if not path_str:
        return VerifyResult(
            ok=True,
            message="保存后将根据数据源 ID 自动创建 CSV（data/datasources/<id>.csv）",
        )
    path = resolve_csv_path(path_str)
    if not path.is_file():
        parent_error = _verify_parent_writable(path.parent)
        if parent_error is not None:
            return parent_error
        return VerifyResult(ok=True, message=f"将创建 CSV: {path}")
    return VerifyResult(ok=True, message=f"CSV 可读: {path}")


def _verify_csv_write_path(path: Path) -> VerifyResult:
    parent_error = _verify_parent_writable(path.parent)
    if parent_error is not None:
        return parent_error
    if path.is_file():
        try:
            if not os.access(path, os.R_OK):
                return VerifyResult(ok=False, message=f"文件不可读: {path}")
            if not os.access(path, os.W_OK):
                return VerifyResult(ok=False, message=f"文件不可写: {path}")
        except OSError as e:
            return VerifyResult(ok=False, message=f"无法访问路径: {e}")
        return VerifyResult(ok=True, message=f"CSV 可读写: {path}")
    return VerifyResult(ok=True, message=f"CSV 写入目标可用（文件尚不存在）: {path}")


def _verify_csv_read_path(path: Path) -> VerifyResult:
    if not path.is_file():
        return VerifyResult(ok=False, message=f"文件不存在: {path}")
    try:
        if not os.access(path, os.R_OK):
            return VerifyResult(ok=False, message=f"文件不可读: {path}")
    except OSError as e:
        return VerifyResult(ok=False, message=f"无法访问路径: {e}")
    return VerifyResult(ok=True, message=f"CSV 可读: {path}")


class CsvWriteConfig(BaseModel):
    """同步写入选项（存于 ``write`` 段）。"""

    model_config = ConfigDict(extra="ignore")

    write_enabled: bool = False


class CsvConnectionConfig(BaseModel):
    """CSV 路径与创建选项（存储 ``connection`` 段）。"""

    model_config = ConfigDict(extra="ignore")

    path: str = ""
    create_if_missing: bool = False
    initial_columns: list[str] = Field(default_factory=lambda: ["date", "asset"])

    @model_validator(mode="after")
    def _validate(self) -> CsvConnectionConfig:
        path_str = str(self.path).strip()
        self.path = path_str
        if self.create_if_missing:
            if path_str and not path_str.lower().endswith(".csv"):
                raise ValueError("CSV 路径须以 .csv 结尾")
        elif not path_str:
            raise ValueError("path 不能为空")
        self.initial_columns = _normalize_column_names(self.initial_columns)
        return self


class CsvColumnsConfig(BaseModel):
    """日期列、资产列与列缓存（存储 ``columns`` 段）。"""

    model_config = ConfigDict(extra="ignore")

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


def _csv_sync_key_columns(*, date_column: str, asset_column: str | None) -> list[str]:
    cols = [date_column]
    if asset_column:
        cols.append(asset_column)
    return cols


def _csv_normalize_sync_keys(
    df: pd.DataFrame,
    *,
    date_column: str,
    asset_column: str | None,
) -> pd.DataFrame:
    if df.empty:
        key_cols = _csv_sync_key_columns(date_column=date_column, asset_column=asset_column)
        return pd.DataFrame(columns=key_cols)
    out = df.loc[
        :, _csv_sync_key_columns(date_column=date_column, asset_column=asset_column)
    ].copy()
    out[date_column] = pd.to_datetime(out[date_column], errors="coerce").dt.normalize()
    if asset_column is not None:
        out[asset_column] = out[asset_column].astype(str)
    return out.drop_duplicates().reset_index(drop=True)


def _csv_filter_sync_new_rows(
    df: pd.DataFrame,
    *,
    existing_keys: pd.DataFrame,
    date_column: str,
    asset_column: str | None,
) -> pd.DataFrame:
    if df.empty or existing_keys.empty:
        return df.reset_index(drop=True)
    key_cols = _csv_sync_key_columns(date_column=date_column, asset_column=asset_column)
    for col in key_cols:
        if col not in df.columns:
            raise ValueError(f"同步结果缺少去重键列: {col!r}")
    incoming_keys = _csv_normalize_sync_keys(df, date_column=date_column, asset_column=asset_column)
    known_keys = _csv_normalize_sync_keys(
        existing_keys, date_column=date_column, asset_column=asset_column
    )
    merged = incoming_keys.merge(known_keys, on=key_cols, how="left", indicator=True)
    is_new = merged["_merge"] == "left_only"
    out = df.loc[is_new.to_numpy()].reset_index(drop=True)
    return out.drop_duplicates(subset=key_cols, keep="last").reset_index(drop=True)


class CsvDataSource(DataSource):
    """从 CSV 读取普通 DataFrame（中性接口，不承载业务语义）。"""

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
        self._path = Path(path)
        self._write_enabled = bool(write_enabled)
        self._create_if_missing = bool(create_if_missing)
        self._initial_columns = _normalize_column_names(initial_columns)
        self._cached_columns = _normalize_column_names(cached_columns)
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

    def _header_columns(self) -> list[str]:
        return _columns_for_new_csv_file(
            initial_columns=self._initial_columns,
            date_column=self._date_column,
            asset_column=self._asset_column,
            cached_columns=self._cached_columns,
        )

    def _ensure_csv_file_exists(self) -> Path:
        path = self._resolved_file_path()
        if path.is_file() and path.stat().st_size > 0:
            return path
        if not self._create_if_missing:
            raise ValueError(f"CSV 文件不存在: {path}")
        ensure_csv_file(path, columns=self._header_columns())
        return path

    def list_columns(self) -> list[str]:
        path = self._resolved_file_path()
        if not path.is_file() or path.stat().st_size == 0:
            if self._create_if_missing:
                return sorted(set(self._header_columns()), key=lambda x: (x.lower(), x))
            raise ValueError(f"CSV 文件不存在: {path}")
        header = pd.read_csv(path, nrows=0, encoding=_CSV_ENCODING)
        cols = [str(c) for c in header.columns]
        return sorted(set(cols), key=lambda x: (x.lower(), x))

    def list_sync_target_physical_columns(self) -> list[str]:
        return self.list_columns()

    def _load_existing_sync_keys(self, path: Path) -> pd.DataFrame:
        key_cols = _csv_sync_key_columns(
            date_column=self._date_column,
            asset_column=self._asset_column,
        )
        if not path.is_file() or path.stat().st_size == 0:
            return pd.DataFrame(columns=key_cols)
        header = pd.read_csv(path, nrows=0, encoding=_CSV_ENCODING)
        present = set(header.columns)
        usecols = [c for c in key_cols if c in present]
        if self._date_column not in present:
            return pd.DataFrame(columns=key_cols)
        return pd.read_csv(path, usecols=usecols, encoding=_CSV_ENCODING)

    def write_sync_dataframe(self, df: pd.DataFrame) -> int:
        if df.empty:
            return 0
        if not self._write_enabled:
            raise ValueError("目标数据源未开启 write_enabled，拒绝写入")

        path = self._resolved_file_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        write_kw: dict = {"encoding": _CSV_ENCODING, "index": False}

        existing_keys = self._load_existing_sync_keys(path)
        df = _csv_filter_sync_new_rows(
            df,
            existing_keys=existing_keys,
            date_column=self._date_column,
            asset_column=self._asset_column,
        )
        if df.empty:
            return 0

        file_exists = path.is_file() and path.stat().st_size > 0
        if file_exists:
            existing_cols = list(pd.read_csv(path, nrows=0, encoding=_CSV_ENCODING).columns)
            missing_in_df = sorted(set(existing_cols) - set(df.columns))
            if missing_in_df:
                raise ValueError(f"同步结果缺少目标 CSV 已有列: {missing_in_df}")
            extra_in_df = sorted(set(df.columns) - set(existing_cols))
            if extra_in_df:
                raise ValueError(f"同步结果包含目标 CSV 中不存在的列: {extra_in_df}")
            df.loc[:, existing_cols].to_csv(path, mode="a", header=False, **write_kw)
        else:
            df.to_csv(path, mode="w", header=True, **write_kw)
        return len(df)

    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        file_path = self._ensure_csv_file_exists()
        usecols = sorted({str(c) for c in columns})
        header = pd.read_csv(file_path, nrows=0, encoding=_CSV_ENCODING)
        present = set(header.columns)
        missing = sorted(set(usecols) - present)
        if missing:
            raise ValueError(
                f"CSV 缺少所需列. Missing in file: {missing}. Columns present: {sorted(present)}."
            )
        df = pd.read_csv(file_path, usecols=usecols, encoding=_CSV_ENCODING)
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
                ui_schema={
                    "columns": {"ui:widget": "hidden"},
                },
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
            conn = {**conn, "path": csv_path_for_datasource_id(datasource_id)}
            raw["connection"] = conn
        return raw

    def encrypt_storage_config(self, storage_config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(storage_config or {})
        conn = _normalize_connection_form_raw(dict(raw.get("connection") or {}))
        return super().encrypt_storage_config({**raw, "connection": conn})

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(config or {})
        conn = CsvConnectionConfig.model_validate(
            _normalize_connection_form_raw(dict(raw.get("connection") or {}))
        )
        col = CsvColumnsConfig.model_validate(dict(raw.get("columns") or {}))
        write = CsvWriteConfig.model_validate(dict(raw.get("write") or {}))
        if conn.create_if_missing and conn.path:
            p = resolve_csv_path(conn.path)
            header_cols = _columns_for_new_csv_file(
                initial_columns=conn.initial_columns,
                date_column=col.date_column,
                asset_column=col.asset_column,
                cached_columns=col.columns,
            )
            ensure_csv_file(p, columns=header_cols)
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
            "write": write.model_dump(mode="json"),
        }

    def to_datasource(self, config: dict[str, Any]):
        raw = dict(config or {})
        conn = CsvConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        col = CsvColumnsConfig.model_validate(dict(raw.get("columns") or {}))
        write = CsvWriteConfig.model_validate(dict(raw.get("write") or {}))
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
        raw = dict(config or {})
        try:
            conn = CsvConnectionConfig.model_validate(
                _normalize_connection_form_raw(dict(raw.get("connection") or {}))
            )
            write = CsvWriteConfig.model_validate(dict(raw.get("write") or {}))
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))
        if conn.create_if_missing:
            return _verify_csv_create_if_missing(conn)
        path = resolve_csv_path(conn.path)
        if write.write_enabled:
            return _verify_csv_write_path(path)
        return _verify_csv_read_path(path)


class CsvDataSourcePlugin(DataSourcePlugin):
    name: Literal["csv"] = "csv"

    spec = CsvDataSourceSpec()


CSV_PLUGIN = CsvDataSourcePlugin()
