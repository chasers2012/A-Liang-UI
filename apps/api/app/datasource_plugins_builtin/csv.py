from __future__ import annotations

import os
from typing import Any, Literal

from app.datasource.controller import resolve_csv_path
from app.datasource.plugins import (
    DataSourcePlugin,
    PluginConfigField,
    PluginConfigSchema,
    VerifyResult,
)
from datasources import CsvDataSource
from pydantic import BaseModel, Field, model_validator


class CsvConfig(BaseModel):
    path: str
    read_csv_kwargs: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate(self) -> CsvConfig:
        if not str(self.path).strip():
            raise ValueError("path 不能为空")
        return self


class CsvDataSourcePlugin(DataSourcePlugin):
    type: Literal["csv"] = "csv"

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = CsvConfig.model_validate(config)
        return cfg.model_dump(mode="json")

    def to_factor_datasource(self, config: dict[str, Any]):
        cfg = CsvConfig.model_validate(config)
        return CsvDataSource(path=cfg.path, read_csv_kwargs=dict(cfg.read_csv_kwargs))

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        try:
            cfg = CsvConfig.model_validate(config)
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))
        p = resolve_csv_path(cfg.path)
        if not p.is_file():
            return VerifyResult(ok=False, message=f"文件不存在: {p}")
        try:
            if not os.access(p, os.R_OK):
                return VerifyResult(ok=False, message=f"文件不可读: {p}")
        except OSError as e:
            return VerifyResult(ok=False, message=f"无法访问路径: {e}")
        return VerifyResult(ok=True, message=f"CSV 可读: {p}")

    def get_config_schema(self) -> PluginConfigSchema | None:
        return PluginConfigSchema(
            title="CSV 数据源",
            description="路径可为绝对路径，或相对于 workspace 根目录的相对路径。",
            fields=[
                PluginConfigField(
                    key="path",
                    label="文件路径",
                    required=True,
                ),
                PluginConfigField(
                    key="read_csv_kwargs",
                    label="read_csv_kwargs（JSON）",
                    kind="json",
                    placeholder="{}",
                ),
            ],
        )


CSV_PLUGIN = CsvDataSourcePlugin()
