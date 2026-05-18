from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from .loaders import API_CATALOG


class BaoStockConnectionConfig(BaseModel):
    """接口与各 API 专有参数（存储 ``connection`` 段）。"""

    model_config = {"extra": "allow"}

    api_name: str = API_CATALOG.default_api_name

    @model_validator(mode="after")
    def _validate(self) -> BaoStockConnectionConfig:
        self.api_name = str(self.api_name).strip()
        if not self.api_name:
            raise ValueError("api_name 不能为空")
        if self.api_name not in API_CATALOG.default_date_columns:
            raise ValueError(f"api_name 不在支持列表中: {self.api_name}")
        return self


class BaoStockColumnsConfig(BaseModel):
    """日期列、资产列与列缓存（存储 ``columns`` 段）；须与 connection 的 api_name 一致。"""

    api_name: str = API_CATALOG.default_api_name
    date_column: str = API_CATALOG.default_date_column
    asset_column: str | None = API_CATALOG.default_asset_column
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> BaoStockColumnsConfig:
        self.api_name = str(self.api_name).strip()
        if not self.api_name:
            raise ValueError("api_name 不能为空")
        if self.api_name not in API_CATALOG.default_date_columns:
            raise ValueError(f"api_name 不在支持列表中: {self.api_name}")
        self.date_column = str(self.date_column).strip()
        if not self.date_column:
            raise ValueError("date_column 不能为空")
        if self.asset_column is not None:
            asset_col = str(self.asset_column).strip()
            self.asset_column = asset_col or None
        self.columns = [str(c).strip() for c in self.columns if str(c).strip()]
        return self
