from __future__ import annotations

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
    ) -> None:
        self._api_name = str(api_name).strip()
        self._api_params = dict(api_params or {})
        bs_session()

    def list_columns(self) -> list[str]:
        fixed_columns = API_FIXED_COLUMNS.get(self._api_name, [])
        return sorted({str(col).strip() for col in fixed_columns if str(col).strip()})

    def load_frame(
        self,
        *,
        columns: list[str],
        date_column: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        asset_column: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        loader = API_LOADERS.get(self._api_name)
        if loader is None:
            raise ValueError(f"BaoStock 未配置 loader: {self._api_name}")
        return loader(
            columns=columns,
            date_column=date_column,
            start_date=start_date,
            end_date=end_date,
            asset_column=asset_column,
            asset_values=asset_values,
            config=self._api_params,
        )


class BaoStockDataSourcePlugin(DataSourcePlugin):
    name: Literal["baostock"] = "baostock"

    config = PluginConfigSchema(
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

    @staticmethod
    def _validate_baostock_config(config: dict[str, Any]) -> BaoStockConfig:
        return BaoStockConfig.model_validate(config)

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        return self._validate_baostock_config(config).model_dump(mode="json")

    def to_factor_datasource(self, config: dict[str, Any]):
        cfg = self._validate_baostock_config(config)
        cfg_dump = cfg.model_dump(mode="json")
        common_keys = {"api_name", "cache_enabled", "cache_ttl_seconds", "cache_dir"}
        api_params = {k: v for k, v in cfg_dump.items() if k not in common_keys}
        return BaoStockDataSource(
            api_name=cfg.api_name,
            api_params=api_params,
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
            common_keys = {"api_name", "cache_enabled", "cache_ttl_seconds", "cache_dir"}
            api_params = {k: v for k, v in cfg_dump.items() if k not in common_keys}
            probe = BaoStockDataSource(
                api_name=cfg.api_name,
                api_params=api_params,
            )

            start_date, end_date = self._get_verify_trade_dates()
            codes = self._get_top5_sz50_codes(end_date)
            df = probe.load_frame(
                columns=[],
                date_column="date",
                start_date=start_date,
                end_date=end_date,
                asset_column="code",
                asset_values=codes,
            )
            if df.empty:
                return VerifyResult(ok=False, message="BaoStock 查询失败: empty result")
        except Exception as e:
            return VerifyResult(ok=False, message=f"BaoStock 校验失败: {e}")
        return VerifyResult(ok=True, message="BaoStock 连接与查询成功。")
