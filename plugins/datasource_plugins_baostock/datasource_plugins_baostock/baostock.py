from __future__ import annotations
# ruff: noqa: I001

from typing import Any, Literal

import baostock as bs
import pandas as pd
from app.datasource.plugins import DataSourcePlugin, VerifyResult
from app.plugin import PluginConfigSchema
from factor.datasource import FactorDataSource

from .common import (
    BaoStockConfig,
    bs_session,
)
from .loaders import SUPPORTED_APIS
from .loaders import (
    API_DEFAULT_ASSET_COLUMNS,
    API_DEFAULT_DATE_COLUMNS,
    DEFAULT_ASSET_COLUMN,
    DEFAULT_DATE_COLUMN,
)

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


class BaoStockDataSource(FactorDataSource):
    def __init__(
        self,
        *,
        api_name: str = "",
        api_params: dict[str, Any] | None = None,
        date_column: str = DEFAULT_DATE_COLUMN,
        asset_column: str | None = DEFAULT_ASSET_COLUMN,
    ) -> None:
        self._api_name = str(api_name).strip()
        self._api_params = dict(api_params or {})
        self._date_column = str(date_column).strip()
        self._asset_column = (
            str(asset_column).strip()
            if asset_column is not None and str(asset_column).strip()
            else None
        )
        bs_session()

    @property
    def date_column(self) -> str:
        return self._date_column

    @property
    def asset_column(self) -> str | None:
        return self._asset_column

    def list_columns(self) -> list[str]:
        fixed_columns = API_FIXED_COLUMNS.get(self._api_name, [])
        return sorted({str(col).strip() for col in fixed_columns if str(col).strip()})

    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        loader = API_LOADERS.get(self._api_name)
        if loader is None:
            raise ValueError(f"BaoStock 未配置 loader: {self._api_name}")
        return loader(
            columns=columns,
            date_column=self._date_column,
            start_date=start_date,
            end_date=end_date,
            asset_column=self._asset_column,
            asset_values=asset_values,
            config=self._api_params,
        )


class BaoStockDataSourcePlugin(DataSourcePlugin):
    name: Literal["baostock"] = "baostock"

    connection_config = PluginConfigSchema(
        title="BaoStock 数据源",
        description="通过 baostock 拉取 A 股数据（参数由数据集时间和资产过滤驱动）。",
        json_schema={
            "type": "object",
            "properties": {
                "api_name": {
                    "type": "string",
                    "title": "Baostock 接口",
                    "default": API_KEYS[0] if API_KEYS else "",
                    "oneOf": API_OPTIONS,
                },
            },
            "required": ["api_name"],
            "allOf": [
                {
                    "if": {"properties": {"api_name": {"const": api_name}}},
                    "then": API_CONFIG_SCHEMAS.get(api_name, {}),
                }
                for api_name in API_KEYS
            ],
        },
        ui_schema={
            "fields": {
                "ui:options": {"orderable": False, "addable": True, "removable": True},
                "items": {"ui:placeholder": "例如 volume"},
            }
        },
    )
    columns_config = PluginConfigSchema(
        title="BaoStock 字段配置",
        description="配置日期列和资产列。",
        json_schema={
            "type": "object",
            "properties": {
                "api_name": {
                    "type": "string",
                    "title": "Baostock 接口",
                    "default": API_KEYS[0] if API_KEYS else "",
                    "oneOf": API_OPTIONS,
                },
                "date_column": {
                    "type": "string",
                    "title": "日期列",
                    "default": API_DEFAULT_DATE_COLUMNS.get(API_KEYS[0], DEFAULT_DATE_COLUMN)
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
    )

    @staticmethod
    def _validate_baostock_config(config: dict[str, Any]) -> BaoStockConfig:
        return BaoStockConfig.model_validate(config)

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        return self._validate_baostock_config(config).model_dump(mode="json")

    def to_factor_datasource(self, config: dict[str, Any]):
        cfg = self._validate_baostock_config(config)
        cfg_dump = cfg.model_dump(mode="json")
        common_keys = {
            "api_name",
            "cache_enabled",
            "cache_ttl_seconds",
            "cache_dir",
            "date_column",
            "asset_column",
            "columns",
        }
        api_params = {k: v for k, v in cfg_dump.items() if k not in common_keys}
        return BaoStockDataSource(
            api_name=cfg.api_name,
            api_params=api_params,
            date_column=cfg.date_column,
            asset_column=cfg.asset_column,
        )

    def _get_verify_trade_dates(self) -> str:
        rs = bs.query_trade_dates(
            start_date=(pd.Timestamp.today().normalize() - pd.DateOffset(months=1)).strftime(
                "%Y-%m-%d"
            ),
            end_date=None,
        )
        if str(rs.error_code) != "0":
            raise ValueError(f"BaoStock 查询交易日失败: {rs.error_msg}")
        df_dates = rs.get_data()
        if df_dates.empty:
            raise ValueError("BaoStock 查询交易日失败: empty result")
        if "is_trading_day" not in df_dates.columns or "calendar_date" not in df_dates.columns:
            raise ValueError("BaoStock 查询交易日失败: missing expected columns")
        trade_dates = df_dates.loc[
            df_dates["is_trading_day"].astype(str) == "1", "calendar_date"
        ].tolist()
        if not trade_dates:
            raise ValueError("BaoStock 查询交易日失败: no trading day found")
        end_date = str(trade_dates[-1]).strip()
        start_date = str(trade_dates[-3]).strip() if len(trade_dates) >= 3 else end_date
        if not end_date:
            raise ValueError("BaoStock 查询交易日失败: invalid last trade date")
        return start_date, end_date

    def _get_top5_sz50_codes(self, date_value: str) -> list[str]:
        rs = bs.query_sz50_stocks(date=date_value)
        if str(rs.error_code) != "0":
            raise ValueError(f"BaoStock 查询上证50成分股失败: {rs.error_msg}")
        df_sz50 = rs.get_data()
        if df_sz50.empty or "code" not in df_sz50.columns:
            raise ValueError("BaoStock 查询上证50成分股失败: empty result")
        codes = [str(v).strip() for v in df_sz50["code"].tolist() if str(v).strip()]
        if not codes:
            raise ValueError("BaoStock 查询上证50成分股失败: no code found")
        return codes[:5]

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        try:
            cfg = self._validate_baostock_config(config)
            cfg_dump = cfg.model_dump(mode="json")
            common_keys = {
                "api_name",
                "cache_enabled",
                "cache_ttl_seconds",
                "cache_dir",
                "date_column",
                "asset_column",
                "columns",
            }
            api_params = {k: v for k, v in cfg_dump.items() if k not in common_keys}
            probe = BaoStockDataSource(
                api_name=cfg.api_name,
                api_params=api_params,
                date_column=cfg.date_column,
                asset_column=cfg.asset_column,
            )

            start_date, end_date = self._get_verify_trade_dates()
            codes = self._get_top5_sz50_codes(end_date)
            df = probe.load_frame(
                columns=[],
                start_date=start_date,
                end_date=end_date,
                asset_values=codes,
            )
            if df.empty:
                return VerifyResult(ok=False, message="BaoStock 查询失败: empty result")
        except Exception as e:
            return VerifyResult(ok=False, message=f"BaoStock 校验失败: {e}")
        return VerifyResult(ok=True, message="BaoStock 连接与查询成功。")

    def list_table_columns(self, config: dict[str, Any]) -> list[str]:
        cfg = self._validate_baostock_config(config)
        probe = BaoStockDataSource(
            api_name=cfg.api_name,
            api_params={},
            date_column=cfg.date_column,
            asset_column=cfg.asset_column,
        )
        return probe.list_columns()
