from __future__ import annotations

from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app import datetime_utils

FACTORS_DIR = "factors/source"

utc_now_iso = datetime_utils.utc_now_iso


def default_factor_source(factor_name: str) -> str:
    """Minimal UserFactor skeleton; ``factor_name`` becomes the ``name`` class attribute."""
    safe = factor_name.strip() or "my_factor"
    return f'''from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class UserFactor(Factor):
    name = "{safe}"
    group = "custom"
    description = ""
    dependencies = ["close"]
    max_window = 2

    def calc(self, data: pd.DataFrame) -> pd.Series:
        close = data["close"]
        return close.groupby(level="asset", group_keys=False).pct_change(periods=1)
'''


def source_relative_path(factor_id: str) -> str:
    return f"{FACTORS_DIR}/{factor_id}.py"


class FactorRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    group: str = "factor"
    description: str = ""
    max_window: int = 1
    dependencies: list[str] = Field(default_factory=lambda: ["close"])
    source_path: str
    created_at: str
    updated_at: str


class FactorRegistryFile(BaseModel):
    version: int = 1
    items: list[FactorRecord] = Field(default_factory=list)


class FactorCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    group: str = "factor"
    description: str = ""
    max_window: int = 1
    dependencies: list[str] = Field(default_factory=lambda: ["close"])
    source: str | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    @model_validator(mode="after")
    def _deps_and_window(self) -> FactorCreate:
        deps = [d.strip() for d in self.dependencies if str(d).strip()]
        if not deps:
            raise ValueError("dependencies 不能为空")
        if self.max_window < 1:
            raise ValueError("max_window 须 >= 1")
        return self.model_copy(update={"dependencies": deps})

    def to_record(self, factor_id: str, now: str) -> FactorRecord:
        return FactorRecord(
            id=factor_id,
            name=self.name.strip(),
            group=self.group.strip(),
            description=self.description.strip(),
            max_window=self.max_window,
            dependencies=list(self.dependencies),
            source_path=source_relative_path(factor_id),
            created_at=now,
            updated_at=now,
        )


class FactorPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    group: str | None = None
    description: str | None = None
    max_window: int | None = None
    dependencies: list[str] | None = None
    source: str | None = None


class FactorSummaryPublic(BaseModel):
    id: str
    name: str
    group: str
    description: str
    max_window: int
    dependencies: list[str]
    source_path: str
    created_at: str
    updated_at: str


class FactorDetailPublic(FactorSummaryPublic):
    source: str


class FactorDefaultSourcePublic(BaseModel):
    """Editor bootstrap: Python skeleton from :func:`default_factor_source`."""

    source: str


def record_to_summary(rec: FactorRecord) -> FactorSummaryPublic:
    return FactorSummaryPublic(
        id=rec.id,
        name=rec.name,
        group=rec.group,
        description=rec.description,
        max_window=rec.max_window,
        dependencies=list(rec.dependencies),
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def new_factor_id() -> str:
    return str(uuid4())
