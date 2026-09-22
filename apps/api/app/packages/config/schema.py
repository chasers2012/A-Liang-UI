from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.packages.form.schema import FormSchema


class ConfigModuleSpec(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    key: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)
    form: FormSchema
    default_values: dict[str, Any] = Field(default_factory=dict)

    @field_validator("key", "filename", mode="before")
    @classmethod
    def _strip_module_text(cls, value: object) -> str:
        text = str(value or "").strip()
        if not text:
            raise ValueError("must be non-empty")
        return text

    @field_validator("form")
    @classmethod
    def _form_title_nonempty(cls, value: FormSchema) -> FormSchema:
        if not str(value.title or "").strip():
            raise ValueError("form.title must be non-empty")
        return value


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
