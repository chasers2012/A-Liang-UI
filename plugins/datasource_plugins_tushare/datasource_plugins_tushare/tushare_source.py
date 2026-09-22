from __future__ import annotations
# ruff: noqa: I001

from collections.abc import Callable
from dataclasses import dataclass
from functools import cache
from types import MappingProxyType
from typing import Any, Literal

import pandas as pd
from app.packages.datasource.plugins import DataSourcePlugin
from app.packages.datasource.schemas import DataSourceSpec
from app.infra.form import FormSchema
from data_source import DataSource, VerifyResult

from .client import TushareIOBusyError, call_pro, resolve_token, run_tushare_io
from .common import TushareColumnsConfig, TushareConnectionConfig
from .loaders import SUPPORTED_APIS
from .loaders import (
    API_DEFAULT_ASSET_COLUMNS,
    API_DEFAULT_DATE_COLUMNS,
    DEFAULT_ASSET_COLUMN,
    DEFAULT_DATE_COLUMN,
)
from .loaders._utils import normalize_date_column, to_ts_code


class TushareDataSource(DataSource):
    @dataclass(frozen=True, slots=True)
    class ApiCatalog:
        keys: tuple[str, ...]
        options: tuple[dict[str, str], ...]
        config_schemas: MappingProxyType[str, dict[str, Any]]
        loaders: MappingProxyType[str, Callable[..., Any]]
        fixed_columns: MappingProxyType[str, tuple[str, ...]]
        columns_for_config: MappingProxyType[str, Callable[..., list[str]]]

    @classmethod
    @cache
    def _api_catalog(cls) -> ApiCatalog:
        keys: list[str] = []
        options: list[dict[str, str]] = []
        config_schemas: dict[str, dict[str, Any]] = {}
        loaders: dict[str, Callable[..., Any]] = {}
        fixed_columns: dict[str, tuple[str, ...]] = {}
        columns_for_config: dict[str, Callable[..., list[str]]] = {}
        for api in SUPPORTED_APIS:
            key = api.get("key")
            if not key:
                continue
            key_str = str(key)
            label = api.get("label")
            if label:
                keys.append(key_str)
                options.append({"const": key_str, "title": str(label)})
            config_schemas[key_str] = dict(api.get("config") or {})
            loader = api.get("loader")
            if callable(loader):
                loaders[key_str] = loader
            fixed_columns[key_str] = tuple(str(c) for c in (api.get("columns") or []))
            resolver = api.get("columns_for_config")
            if callable(resolver):
                columns_for_config[key_str] = resolver
        return cls.ApiCatalog(
            keys=tuple(keys),
            options=tuple(options),
            config_schemas=MappingProxyType(config_schemas),
            loaders=MappingProxyType(loaders),
            fixed_columns=MappingProxyType(fixed_columns),
            columns_for_config=MappingProxyType(columns_for_config),
        )

    def __init__(
        self,
        *,
        token: str,
        api_name: str = "",
        api_params: dict[str, Any] | None = None,
        date_column: str = DEFAULT_DATE_COLUMN,
        asset_column: str | None = DEFAULT_ASSET_COLUMN,
    ) -> None:
        self._token = resolve_token(token)
        self._api_name = str(api_name).strip()
        self._api_params = dict(api_params or {})
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

    def list_columns(self) -> list[str]:
        catalog = self._api_catalog()
        resolver = catalog.columns_for_config.get(self._api_name)
        if resolver is not None:
            cols = resolver(self._api_params)
            return sorted({str(col).strip() for col in cols if str(col).strip()})
        fixed_columns = catalog.fixed_columns.get(self._api_name, ())
        return sorted({str(col).strip() for col in fixed_columns if str(col).strip()})

    def _loader_config(self) -> dict[str, Any]:
        return {**self._api_params, "token": self._token}

    def _load_frame_core(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        loader = self._api_catalog().loaders.get(self._api_name)
        if loader is None:
            raise ValueError(f"Tushare 未配置 loader: {self._api_name}")
        frame = loader(
            columns=columns,
            date_column=self._date_column,
            start_date=start_date,
            end_date=end_date,
            asset_column=self._asset_column,
            asset_values=asset_values,
            config=self._loader_config(),
        )
        return normalize_date_column(frame, self._date_column)

    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        return run_tushare_io(
            lambda: self._load_frame_core(
                columns=columns,
                start_date=start_date,
                end_date=end_date,
                asset_values=asset_values,
            )
        )

    def write_data(self, df: pd.DataFrame) -> int:
        raise NotImplementedError("Tushare 数据源为只读，不支持写入")

    def _get_verify_trade_dates(self) -> tuple[str, str]:
        end = pd.Timestamp.today().normalize()
        start = end - pd.DateOffset(months=1)
        df = call_pro(
            self._token,
            "trade_cal",
            exchange="SSE",
            start_date=start.strftime("%Y%m%d"),
            end_date=end.strftime("%Y%m%d"),
            is_open="1",
            fields="cal_date",
        )
        if df.empty or "cal_date" not in df.columns:
            raise ValueError("Tushare 查询交易日失败: empty result")
        trade_dates = [str(v).strip() for v in df["cal_date"].tolist() if str(v).strip()]
        if not trade_dates:
            raise ValueError("Tushare 查询交易日失败: no trading day found")
        end_date = trade_dates[-1]
        start_date = trade_dates[-3] if len(trade_dates) >= 3 else end_date
        return start_date, end_date

    def _get_top5_hs300_codes(self, trade_date: str) -> list[str]:
        df = call_pro(
            self._token,
            "index_weight",
            index_code="000300.SH",
            start_date=trade_date,
            end_date=trade_date,
            fields="con_code",
        )
        if df.empty or "con_code" not in df.columns:
            raise ValueError("Tushare 查询沪深300成分股失败: empty result")
        codes = [to_ts_code(str(v)) for v in df["con_code"].tolist() if str(v).strip()]
        if not codes:
            raise ValueError("Tushare 查询沪深300成分股失败: no code found")
        return codes[:5]

    def verify(self) -> VerifyResult:
        try:

            def _verify_load() -> pd.DataFrame:
                start_date, end_date = self._get_verify_trade_dates()
                codes = self._get_top5_hs300_codes(end_date)
                return self._load_frame_core(
                    columns=[],
                    start_date=start_date,
                    end_date=end_date,
                    asset_values=codes,
                )

            df = run_tushare_io(_verify_load, blocking=False)
            if df.empty:
                return VerifyResult(ok=False, message="Tushare 查询失败: empty result")
        except TushareIOBusyError as e:
            return VerifyResult(ok=False, message=str(e))
        except Exception as e:
            return VerifyResult(ok=False, message=f"Tushare 校验失败: {e}")
        return VerifyResult(ok=True, message="Tushare 连接与查询成功。")


class TushareDataSourceSpec(DataSourceSpec):
    @classmethod
    def parse_connection_columns(
        cls,
        raw: dict[str, Any],
    ) -> tuple[TushareConnectionConfig, TushareColumnsConfig]:
        config = dict(raw or {})
        conn = TushareConnectionConfig.model_validate(dict(config.get("connection") or {}))
        col_in = dict(config.get("columns") or {})
        if not str(col_in.get("api_name") or "").strip():
            col_in["api_name"] = conn.api_name
        col = TushareColumnsConfig.model_validate(col_in)
        if col.api_name != conn.api_name:
            raise ValueError("columns.api_name 须与 connection.api_name 一致")
        return conn, col

    @staticmethod
    def connection_api_params(conn: TushareConnectionConfig) -> dict[str, Any]:
        conn_dump = conn.model_dump(mode="json")
        return {k: v for k, v in conn_dump.items() if k not in ("api_name", "token")}

    def __init__(self) -> None:
        catalog = TushareDataSource._api_catalog()
        api_keys = catalog.keys
        api_options = catalog.options
        api_config_schemas = catalog.config_schemas
        first_api_key = api_keys[0] if api_keys else ""
        super().__init__(
            connection_schema=FormSchema(
                title="Tushare 数据源",
                description="通过 Tushare Pro 拉取 A 股及指数等数据（需 Token）。",
                secret_keys=["token"],
                json_schema={
                    "type": "object",
                    "properties": {
                        "token": {
                            "type": "string",
                            "title": "Tushare Token",
                            "description": "可在 tushare.pro 注册获取；也可使用环境变量 TUSHARE_TOKEN。",
                            "default": "",
                        },
                        "api_name": {
                            "type": "string",
                            "title": "Tushare 接口",
                            "default": first_api_key,
                            "oneOf": list(api_options),
                        },
                    },
                    "required": ["token", "api_name"],
                    "allOf": [
                        {
                            "if": {"properties": {"api_name": {"const": api_name}}},
                            "then": api_config_schemas.get(api_name, {}),
                        }
                        for api_name in api_keys
                    ],
                },
                ui_schema={
                    "token": {
                        "ui:widget": "password",
                        "ui:placeholder": "在 tushare.pro 获取",
                    },
                },
            ),
            columns_schema=FormSchema(
                title="Tushare 字段配置",
                description="配置日期列和资产列。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "api_name": {
                            "type": "string",
                            "title": "Tushare 接口",
                            "default": first_api_key,
                            "oneOf": list(api_options),
                        },
                        "date_column": {
                            "type": "string",
                            "title": "日期列",
                            "default": API_DEFAULT_DATE_COLUMNS.get(
                                first_api_key, DEFAULT_DATE_COLUMN
                            )
                            if first_api_key
                            else DEFAULT_DATE_COLUMN,
                        },
                        "asset_column": {
                            "type": ["string", "null"],
                            "title": "资产列",
                            "default": (
                                API_DEFAULT_ASSET_COLUMNS.get(first_api_key)
                                if first_api_key
                                else DEFAULT_ASSET_COLUMN
                            ),
                        },
                        "columns": {
                            "type": "array",
                            "title": "可选列缓存",
                            "items": {"type": "string"},
                            "default": [],
                        },
                    },
                    "required": ["api_name", "date_column"],
                    "allOf": [
                        {
                            "if": {
                                "required": ["api_name"],
                                "properties": {"api_name": {"const": api_name}},
                            },
                            "then": {
                                "properties": {
                                    "date_column": {
                                        "default": API_DEFAULT_DATE_COLUMNS.get(
                                            api_name, DEFAULT_DATE_COLUMN
                                        ),
                                    },
                                    "asset_column": {
                                        "default": API_DEFAULT_ASSET_COLUMNS.get(api_name),
                                    },
                                }
                            },
                        }
                        for api_name in api_keys
                    ],
                },
                ui_schema={
                    "api_name": {"ui:widget": "hidden"},
                    "columns": {"ui:widget": "hidden"},
                },
            ),
        )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        conn, col = self.parse_connection_columns(config)
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
        }

    def to_datasource(self, config: dict[str, Any]):
        conn, col = self.parse_connection_columns(config)
        return TushareDataSource(
            token=conn.token,
            api_name=conn.api_name,
            api_params=self.connection_api_params(conn),
            date_column=col.date_column,
            asset_column=col.asset_column,
        )


class TushareDataSourcePlugin(DataSourcePlugin):
    name: Literal["tushare"] = "tushare"

    spec = TushareDataSourceSpec()
