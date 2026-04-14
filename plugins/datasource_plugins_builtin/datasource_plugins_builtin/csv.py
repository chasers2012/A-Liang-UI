from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

from app.datasource.plugins import DataSourcePlugin, VerifyResult
from app.plugin import PluginConfigSchema
from datasources import CsvDataSource
from pydantic import BaseModel, Field, model_validator
from workspace import get_workspace_root


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


class CsvConfig(BaseModel):
    path: str
    read_csv_kwargs: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate(self) -> CsvConfig:
        if not str(self.path).strip():
            raise ValueError("path 不能为空")
        return self


class CsvDataSourcePlugin(DataSourcePlugin):
    name: Literal["csv"] = "csv"

    config = PluginConfigSchema(
        title="CSV 数据源",
        description="路径可为绝对路径，或相对于 workspace 根目录的相对路径。",
        json_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "title": "文件路径"},
                "read_csv_kwargs": {
                    "type": "object",
                    "title": "read_csv_kwargs（JSON）",
                    "default": {},
                },
            },
            "required": ["path"],
        },
        ui_schema={
            "path": {
                "ui:widget": "file",
                "ui:options": {"accept": ".csv,text/csv"},
                "ui:help": "可填写绝对路径，或相对于 workspace 根目录的相对路径。",
            },
            "read_csv_kwargs": {
                "ui:widget": "textarea",
                "ui:options": {"rows": 6},
                "ui:placeholder": "{}",
            },
        },
    )

    @staticmethod
    def _validate_csv_config(config: dict[str, Any]) -> CsvConfig:
        path = config.get("path")
        if path is None or not str(path).strip():
            raise ValueError("path 不能为空")
        return CsvConfig.model_validate(config)

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = self._validate_csv_config(config)
        return cfg.model_dump(mode="json")

    def to_factor_datasource(self, config: dict[str, Any]):
        cfg = self._validate_csv_config(config)
        return CsvDataSource(path=cfg.path, read_csv_kwargs=dict(cfg.read_csv_kwargs))

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        try:
            cfg = self._validate_csv_config(config)
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


CSV_PLUGIN = CsvDataSourcePlugin()
