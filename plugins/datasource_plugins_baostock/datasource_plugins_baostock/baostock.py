from __future__ import annotations
# ruff: noqa: I001

import inspect
from typing import Any, Literal

import baostock as bs
import pandas as pd
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec
from app.form import FormSchema
from data_source import DataSource, VerifyResult

from .common import BaoStockColumnsConfig, BaoStockConnectionConfig
from .session import BaostockIOBusyError, BaostockSession, baostock_session
from .loaders import API_CATALOG


class BaoStockDataSource(DataSource):
    def __init__(
        self,
        *,
        api_name: str = "",
        api_params: dict[str, Any] | None = None,
        date_column: str = API_CATALOG.default_date_column,
        asset_column: str | None = API_CATALOG.default_asset_column,
    ) -> None:
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
        fixed_columns = API_CATALOG.fixed_columns.get(self._api_name, ())
        return sorted({str(col).strip() for col in fixed_columns if str(col).strip()})

    @baostock_session
    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        loader = API_CATALOG.loaders.get(self._api_name)
        if loader is None:
            raise ValueError(f"BaoStock 未配置 loader: {self._api_name}")
        loader_params = inspect.signature(loader).parameters
        call_kwargs = {
            "columns": columns,
            "start_date": start_date,
            "end_date": end_date,
            "asset_values": asset_values,
            "config": self._api_params,
        }
        return loader(**{k: v for k, v in call_kwargs.items() if k in loader_params})

    def write_data(self, df: pd.DataFrame) -> int:
        raise NotImplementedError("BaoStock 数据源为只读，不支持写入")

    def _get_verify_trade_dates(self) -> tuple[str, str]:
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

    @baostock_session
    def verify(self, *, session: BaostockSession | None = None) -> VerifyResult:
        try:
            start_date, end_date = self._get_verify_trade_dates()
            codes = self._get_top5_sz50_codes(end_date)
            df = self.load_frame(
                columns=[],
                start_date=start_date,
                end_date=end_date,
                asset_values=codes,
                session=session,
            )
            if df.empty:
                return VerifyResult(ok=False, message="BaoStock 查询失败: empty result")
        except BaostockIOBusyError as e:
            return VerifyResult(ok=False, message=str(e))
        except Exception as e:
            return VerifyResult(ok=False, message=f"BaoStock 校验失败: {e}")
        return VerifyResult(ok=True, message="BaoStock 连接与查询成功。")


class BaoStockDataSourceSpec(DataSourceSpec):
    @classmethod
    def parse_connection_columns(
        cls,
        raw: dict[str, Any],
    ) -> tuple[BaoStockConnectionConfig, BaoStockColumnsConfig]:
        config = dict(raw or {})
        conn = BaoStockConnectionConfig.model_validate(dict(config.get("connection") or {}))
        col_in = dict(config.get("columns") or {})
        col_in.pop("api_name", None)
        col = BaoStockColumnsConfig.model_validate(col_in)
        return conn, col

    @staticmethod
    def connection_api_params(conn: BaoStockConnectionConfig) -> dict[str, Any]:
        conn_dump = conn.model_dump(mode="json")
        return {k: v for k, v in conn_dump.items() if k != "api_name"}

    def __init__(self) -> None:
        api_keys = API_CATALOG.keys
        api_options = API_CATALOG.options
        api_config_schemas = API_CATALOG.config_schemas
        first_api_key = api_keys[0] if api_keys else ""
        super().__init__(
            connection_schema=FormSchema(
                title="BaoStock 数据源",
                description="通过 baostock 拉取 A 股数据（参数由数据集时间和资产过滤驱动）。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "api_name": {
                            "type": "string",
                            "title": "Baostock 接口",
                            "default": first_api_key,
                            "oneOf": list(api_options),
                        },
                    },
                    "required": ["api_name"],
                    "allOf": [
                        {
                            "if": {"properties": {"api_name": {"const": api_name}}},
                            "then": api_config_schemas.get(api_name, {}),
                        }
                        for api_name in api_keys
                    ],
                },
                ui_schema={
                    # Per-api connection widgets are defined by each loader's config schema.
                },
            ),
            columns_schema=FormSchema(
                title="BaoStock 字段配置",
                description="配置日期列和资产列（接口名在连接配置中选择）。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "date_column": {
                            "type": "string",
                            "title": "日期列",
                            "default": API_CATALOG.default_date_columns.get(
                                first_api_key, API_CATALOG.default_date_column
                            )
                            if first_api_key
                            else API_CATALOG.default_date_column,
                        },
                        "asset_column": {
                            "type": ["string", "null"],
                            "title": "资产列",
                            "default": (
                                API_CATALOG.default_asset_columns.get(first_api_key)
                                if first_api_key
                                else API_CATALOG.default_asset_column
                            ),
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
        conn, col = self.parse_connection_columns(config)
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
        }

    def to_datasource(self, config: dict[str, Any]):
        conn, col = self.parse_connection_columns(config)
        return BaoStockDataSource(
            api_name=conn.api_name,
            api_params=self.connection_api_params(conn),
            date_column=col.date_column,
            asset_column=col.asset_column,
        )


class BaoStockDataSourcePlugin(DataSourcePlugin):
    name: Literal["baostock"] = "baostock"

    spec = BaoStockDataSourceSpec()
