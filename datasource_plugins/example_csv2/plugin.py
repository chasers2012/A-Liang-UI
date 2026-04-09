from __future__ import annotations

from typing import Any, Literal

from app.datasource.plugins import (
    DataSourcePlugin,
    PluginConfigField,
    PluginConfigSchema,
    VerifyResult,
)
from datasources import CsvDataSource
from pydantic import BaseModel, Field


class Csv2Config(BaseModel):
    path: str
    encoding: str = "utf-8-sig"
    read_csv_kwargs: dict[str, Any] = Field(default_factory=dict)


class Csv2Plugin(DataSourcePlugin):
    """
    Example workspace plugin.

    This demonstrates a plugin-defined config schema that differs from the built-in `csv` plugin.
    """

    type: Literal["csv2"] = "csv2"

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = Csv2Config.model_validate(config)
        d = cfg.model_dump(mode="json")
        # normalize kwargs: always apply encoding unless user overrides it explicitly
        kw = dict(d.get("read_csv_kwargs") or {})
        kw.setdefault("encoding", d["encoding"])
        d["read_csv_kwargs"] = kw
        return d

    def to_factor_datasource(self, config: dict[str, Any]):
        cfg = Csv2Config.model_validate(config)
        return CsvDataSource(path=cfg.path, read_csv_kwargs=dict(cfg.read_csv_kwargs))

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        # Keep it simple: rely on CsvDataSource itself during real usage.
        try:
            Csv2Config.model_validate(config)
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))
        return VerifyResult(ok=True, message="OK")

    def get_config_schema(self) -> PluginConfigSchema | None:
        return PluginConfigSchema(
            title="CSV2 数据源（示例插件）",
            description="示例：插件可以自定义字段和默认行为。",
            fields=[
                PluginConfigField(key="path", label="文件路径", required=True),
                PluginConfigField(
                    key="encoding",
                    label="编码",
                    placeholder="utf-8-sig",
                ),
                PluginConfigField(
                    key="read_csv_kwargs",
                    label="read_csv_kwargs（JSON）",
                    kind="json",
                    placeholder="{}",
                ),
            ],
        )


DATASOURCE_PLUGINS = [Csv2Plugin()]
