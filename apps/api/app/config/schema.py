from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConfigModuleSpec(BaseModel):
    key: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str | None = None
    filename: str = Field(..., min_length=1)
    json_schema: dict[str, Any] = Field(default_factory=dict)
    ui_schema: dict[str, Any] = Field(default_factory=dict)
    default_values: dict[str, Any] = Field(default_factory=dict)

    @field_validator("key", "title", "filename", mode="before")
    @classmethod
    def _strip_module_text(cls, value: object) -> str:
        text = str(value or "").strip()
        if not text:
            raise ValueError("must be non-empty")
        return text


class ConfigModuleSpecPublic(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    title: str
    description: str | None = None
    json_schema: dict[str, Any] = Field(alias="schema")
    ui_schema: dict[str, Any] = Field(alias="uiSchema")


class ConfigSpecsResponse(BaseModel):
    items: list[ConfigModuleSpecPublic]


class ConfigValuesResponse(BaseModel):
    module_key: str
    values: dict[str, Any]
