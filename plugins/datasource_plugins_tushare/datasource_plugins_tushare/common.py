from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from .client import resolve_token
from .loaders import API_DEFAULT_ASSET_COLUMNS, API_DEFAULT_DATE_COLUMNS, DEFAULT_API_NAME

__all__ = [
    "TushareColumnsConfig",
    "TushareConnectionConfig",
]


class TushareConnectionConfig(BaseModel):
    """Token、接口与各 API 专有参数（存储 ``connection`` 段）。"""

    model_config = {"extra": "allow"}

    token: str = ""
    api_name: str = DEFAULT_API_NAME

    @model_validator(mode="after")
    def _validate(self) -> TushareConnectionConfig:
        resolve_token(self.token)
        self.api_name = str(self.api_name).strip()
        if not self.api_name:
            raise ValueError("api_name 不能为空")
        if self.api_name not in API_DEFAULT_DATE_COLUMNS:
            raise ValueError(f"api_name 不在支持列表中: {self.api_name}")
        return self


class TushareColumnsConfig(BaseModel):
    """日期列、资产列与列缓存（存储 ``columns`` 段）；须与 connection 的 api_name 一致。"""

    api_name: str = DEFAULT_API_NAME
    date_column: str = API_DEFAULT_DATE_COLUMNS.get(DEFAULT_API_NAME, "trade_date")
    asset_column: str | None = API_DEFAULT_ASSET_COLUMNS.get(DEFAULT_API_NAME)
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> TushareColumnsConfig:
        self.api_name = str(self.api_name).strip()
        if not self.api_name:
            raise ValueError("api_name 不能为空")
        if self.api_name not in API_DEFAULT_DATE_COLUMNS:
            raise ValueError(f"api_name 不在支持列表中: {self.api_name}")
        self.date_column = str(self.date_column).strip()
        if not self.date_column:
            raise ValueError("date_column 不能为空")
        if self.asset_column is not None:
            asset_col = str(self.asset_column).strip()
            self.asset_column = asset_col or None
        self.columns = [str(c).strip() for c in self.columns if str(c).strip()]
        return self
