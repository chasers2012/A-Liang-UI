from __future__ import annotations

import inspect
from typing import Any

import baostock as bs
from pydantic import BaseModel, Field, model_validator

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

    api_name: str = ""
    fields: list[str] = Field(default_factory=list)
    cache_enabled: bool = True
    cache_ttl_seconds: int = 86400
    cache_dir: str = ".cache/baostock"
    date_column: str = "date"
    asset_column: str | None = "code"
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> BaoStockConfig:
        self.api_name = str(self.api_name).strip()
        if not self.api_name.startswith("query_"):
            raise ValueError("api_name 必须是 baostock 的 query_* 方法名")
        self.fields = [str(f).strip() for f in self.fields if str(f).strip()]
        if self.cache_ttl_seconds < 0:
            raise ValueError("cache_ttl_seconds 不能小于 0")
        if not str(self.cache_dir).strip():
            raise ValueError("cache_dir 不能为空")
        self.date_column = str(self.date_column).strip()
        if not self.date_column:
            raise ValueError("date_column 不能为空")
        if self.asset_column is not None:
            asset_col = str(self.asset_column).strip()
            self.asset_column = asset_col or None
        self.columns = [str(c).strip() for c in self.columns if str(c).strip()]
        return self


def infer_json_schema_type(param: inspect.Parameter) -> dict[str, Any]:
    ann = param.annotation
    default = param.default
    annotation_map = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
        list: "array",
        dict: "object",
    }
    default_type_checks: list[tuple[type[Any], str]] = [
        (bool, "boolean"),
        (int, "integer"),
        (float, "number"),
        (str, "string"),
        (list, "array"),
        (dict, "object"),
    ]

    if ann in annotation_map:
        return {"type": annotation_map[ann]}

    if default is not inspect._empty:
        for default_type, schema_type in default_type_checks:
            if isinstance(default, default_type):
                return {"type": schema_type}
    return {"type": "string"}
