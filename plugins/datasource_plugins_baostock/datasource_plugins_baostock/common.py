from __future__ import annotations

import baostock as bs
from pydantic import BaseModel, Field, model_validator

from .loaders import API_DEFAULT_ASSET_COLUMNS, API_DEFAULT_DATE_COLUMNS, DEFAULT_API_NAME

_bs_logged_in = False


def bs_session():
    global _bs_logged_in
    if not _bs_logged_in:
        lg = bs.login()
        if str(lg.error_code) != "0":
            raise ValueError(f"baostock 登录失败: {lg.error_msg}")
        _bs_logged_in = True
    return bs


class BaoStockConfig(BaseModel):
    model_config = {"extra": "allow"}

    api_name: str = DEFAULT_API_NAME
    date_column: str = API_DEFAULT_DATE_COLUMNS.get(DEFAULT_API_NAME, "date")
    asset_column: str | None = API_DEFAULT_ASSET_COLUMNS.get(DEFAULT_API_NAME)
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> BaoStockConfig:
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
