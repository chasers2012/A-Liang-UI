from __future__ import annotations

from typing import Any

from custom_code import validate_source_syntax
from pydantic import BaseModel, Field, field_validator

from app.preprocessors.constants import DEFAULT_PREPROCESSOR_SOURCE
from app.preprocessors.models import PreprocessorRow
from app.preprocessors.package_manager import PreprocessorPackageManager


class PreprocessorRegistryFile(BaseModel):
    version: int = 1
    items: list[PreprocessorRow] = Field(default_factory=list)


class PreprocessorCreate(BaseModel):
    source: str | None = None

    @field_validator("source")
    @classmethod
    def _strip_source(cls, v: str | None) -> str:
        s = (v or "").strip()
        if not s:
            s = DEFAULT_PREPROCESSOR_SOURCE.strip()
        validate_source_syntax(s)
        # Further validation (must load DataPreprocessorBase subclass) happens in controller.
        return s

    def to_row(self, preprocessor_id: str, now: str) -> PreprocessorRow:
        return PreprocessorRow(
            id=preprocessor_id,
            name=preprocessor_id,
            description="",
            source_path=PreprocessorPackageManager.get_source_path(preprocessor_id),
            created_at=now,
            updated_at=now,
        )


class PreprocessorPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    source: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    @field_validator("description", mode="before")
    @classmethod
    def _strip_desc(cls, v: object) -> str | None:
        if v is None:
            return None
        return str(v).strip()

    @field_validator("source", mode="before")
    @classmethod
    def _strip_source(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("source 不能为空")
        validate_source_syntax(s)
        return s


class PreprocessorSummaryPublic(BaseModel):
    id: str
    name: str
    description: str
    source_path: str
    created_at: str
    updated_at: str


class PreprocessorDetailPublic(PreprocessorSummaryPublic):
    source: str


class DataSetPreprocessorBindingStored(BaseModel):
    preprocessor_id: str
    config: dict[str, Any] | None = None
    datasource_ids: list[str] = Field(default_factory=list)

    @field_validator("preprocessor_id", mode="before")
    @classmethod
    def _strip_id(cls, v: object) -> str:
        s = "" if v is None else str(v).strip()
        if not s:
            raise ValueError("preprocessor_id 不能为空")
        return s

    @field_validator("datasource_ids", mode="before")
    @classmethod
    def _strip_ds_ids(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("datasource_ids must be a list")
        return [str(x).strip() for x in v if str(x).strip()]
