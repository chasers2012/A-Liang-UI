from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


class FactorCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(description="因子名称")
    group: str = Field(description="因子组", default="factor")
    description: str = Field(description="因子描述", default="")
    window: int = Field(description="因子最大窗口", default=1)
    dependencies: list[str] = Field(
        description="因子依赖的列这些列会在data中传给因子calc方法",
        default_factory=lambda: ["close"],
    )
    source: str | None = Field(description="因子源码", default=None)

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
        if self.window < 1:
            raise ValueError("window 须 >= 1")
        return self.model_copy(update={"dependencies": deps})

    def to_row(self, factor_id: str, now: str) -> FactorRow:
        return FactorRow(
            id=factor_id,
            name=self.name.strip(),
            group=self.group.strip(),
            description=self.description.strip(),
            window=self.window,
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
    window: int | None = None
    dependencies: list[str] | None = None
    source: str | None = None


class FactorSummaryPublic(BaseModel):
    id: str
    name: str
    group: str
    description: str
    window: int
    dependencies: list[str]
    source_path: str
    created_at: str
    updated_at: str


class FactorDetailPublic(FactorSummaryPublic):
    source: str


def row_to_summary(row: FactorRow) -> FactorSummaryPublic:
    return FactorSummaryPublic(
        id=row.id,
        name=row.name,
        group=row.group,
        description=row.description,
        window=row.window,
        dependencies=list(row.dependencies),
        source_path=row.source_path,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def new_factor_id() -> str:
    return generate_id()
