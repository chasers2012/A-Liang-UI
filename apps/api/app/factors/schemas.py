from __future__ import annotations

from pydantic import BaseModel, Field

from app.common import datetime_utils
from app.common.id import create_id_generator
from app.factors.models import FactorRow

FACTORS_DIR = "factors/source"

utc_now_iso = datetime_utils.utc_now_iso
generate_id = create_id_generator("factors")


def source_relative_path(factor_id: str) -> str:
    return f"{FACTORS_DIR}/{factor_id}.py"


class FactorRegistryFile(BaseModel):
    version: int = Field(description="因子注册文件版本", default=1)
    items: list[FactorRow] = Field(description="因子注册文件中的因子列表", default_factory=list)


class FactorSummaryPublic(BaseModel):
    id: str
    name: str
    group: str
    description: str
    is_plugin: bool = False
    dependencies: list[str]
    source_path: str
    created_at: str
    updated_at: str


class FactorDetailPublic(FactorSummaryPublic):
    source: str
    param_specs: list[FactorParamSpecPublic] = Field(default_factory=list)


class FactorParamSpecPublic(BaseModel):
    name: str
    label: str
    description: str = ""
    default: float | int | None = None
    min: float | int | None = None
    max: float | int | None = None


def row_to_summary(row: FactorRow) -> FactorSummaryPublic:
    return FactorSummaryPublic(
        id=row.id,
        name=row.name,
        group=row.group,
        description=row.description,
        is_plugin=row.is_plugin,
        dependencies=list(row.dependencies),
        source_path=row.source_path,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def new_factor_id() -> str:
    return generate_id()
