from __future__ import annotations
# ruff: noqa: I001

from typing import Any, Literal

import pandas as pd
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec, VerifyResult
from app.form import FormSchema
from factor.datasource import FactorDataSource

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

API_KEYS = [api.get("key") for api in SUPPORTED_APIS]
API_LABELS = [api.get("label") for api in SUPPORTED_APIS]
API_OPTIONS = [
    {"const": key, "title": label}
    for key, label in zip(API_KEYS, API_LABELS, strict=True)
    if key and label
]
API_CONFIG_SCHEMAS = {api.get("key"): api.get("config", {}) for api in SUPPORTED_APIS}
API_LOADERS = {api.get("key"): api.get("loader") for api in SUPPORTED_APIS}
API_FIXED_COLUMNS = {api.get("key"): api.get("columns", []) for api in SUPPORTED_APIS}
API_COLUMNS_FOR_CONFIG = {
    str(api.get("key")): api.get("columns_for_config")
    for api in SUPPORTED_APIS
    if api.get("key") and callable(api.get("columns_for_config"))
}


class TushareDataSource(FactorDataSource):
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
        resolver = API_COLUMNS_FOR_CONFIG.get(self._api_name)
        if resolver is not None:
            cols = resolver(self._api_params)
            return sorted({str(col).strip() for col in cols if str(col).strip()})
        fixed_columns = API_FIXED_COLUMNS.get(self._api_name, [])
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
        loader = API_LOADERS.get(self._api_name)
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


class TushareDataSourceSpec(DataSourceSpec):
    def __init__(self) -> None:
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
                            "default": API_KEYS[0] if API_KEYS else "",
                            "oneOf": API_OPTIONS,
                        },
                    },
                    "required": ["token", "api_name"],
                    "allOf": [
                        {
                            "if": {"properties": {"api_name": {"const": api_name}}},
                            "then": API_CONFIG_SCHEMAS.get(api_name, {}),
                        }
                        for api_name in API_KEYS
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
                            "default": API_KEYS[0] if API_KEYS else "",
                            "oneOf": API_OPTIONS,
                        },
                        "date_column": {
                            "type": "string",
                            "title": "日期列",
                            "default": API_DEFAULT_DATE_COLUMNS.get(
                                API_KEYS[0], DEFAULT_DATE_COLUMN
                            )
                            if API_KEYS
                            else DEFAULT_DATE_COLUMN,
                        },
                        "asset_column": {
                            "type": ["string", "null"],
                            "title": "资产列",
                            "default": (
                                API_DEFAULT_ASSET_COLUMNS.get(API_KEYS[0])
                                if API_KEYS
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
                        for api_name in API_KEYS
                    ],
                },
                ui_schema={
                    "api_name": {"ui:widget": "hidden"},
                    "columns": {"ui:widget": "hidden"},
                },
            ),
        )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(config or {})
        conn = TushareConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        col_in = dict(raw.get("columns") or {})
        if not str(col_in.get("api_name") or "").strip():
            col_in["api_name"] = conn.api_name
        col = TushareColumnsConfig.model_validate(col_in)
        if col.api_name != conn.api_name:
            raise ValueError("columns.api_name 须与 connection.api_name 一致")
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
        }

    def to_factor_datasource(self, config: dict[str, Any]):
        raw = dict(config or {})
        conn = TushareConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        col_in = dict(raw.get("columns") or {})
        if not str(col_in.get("api_name") or "").strip():
            col_in["api_name"] = conn.api_name
        col = TushareColumnsConfig.model_validate(col_in)
        if col.api_name != conn.api_name:
            raise ValueError("columns.api_name 须与 connection.api_name 一致")
        conn_dump = conn.model_dump(mode="json")
        api_params = {k: v for k, v in conn_dump.items() if k not in ("api_name", "token")}
        return TushareDataSource(
            token=conn.token,
            api_name=conn.api_name,
            api_params=api_params,
            date_column=col.date_column,
            asset_column=col.asset_column,
        )

    def _get_verify_trade_dates(self, token: str) -> tuple[str, str]:
        end = pd.Timestamp.today().normalize()
        start = end - pd.DateOffset(months=1)
        df = call_pro(
            token,
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

    def _get_top5_hs300_codes(self, token: str, trade_date: str) -> list[str]:
        df = call_pro(
            token,
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

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        raw = dict(config or {})
        try:
            conn = TushareConnectionConfig.model_validate(dict(raw.get("connection") or {}))
            col_in = dict(raw.get("columns") or {})
            if not str(col_in.get("api_name") or "").strip():
                col_in["api_name"] = conn.api_name
            col = TushareColumnsConfig.model_validate(col_in)
            if col.api_name != conn.api_name:
                raise ValueError("columns.api_name 须与 connection.api_name 一致")
            token = resolve_token(conn.token)
            conn_dump = conn.model_dump(mode="json")
            api_params = {k: v for k, v in conn_dump.items() if k not in ("api_name", "token")}
            probe = TushareDataSource(
                token=token,
                api_name=conn.api_name,
                api_params=api_params,
                date_column=col.date_column,
                asset_column=col.asset_column,
            )

            def _verify_load() -> pd.DataFrame:
                start_date, end_date = self._get_verify_trade_dates(token)
                codes = self._get_top5_hs300_codes(token, end_date)
                return probe._load_frame_core(
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


class TushareDataSourcePlugin(DataSourcePlugin):
    name: Literal["tushare"] = "tushare"

    spec = TushareDataSourceSpec()
