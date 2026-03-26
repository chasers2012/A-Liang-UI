from __future__ import annotations

from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from app.datasource_schemas import utc_now_iso


class EvaluationTestSetDatasourceBindingStored(BaseModel):
    """Maps one enabled datasource to the logical dependency fields it provides."""

    datasource_id: str
    dependencies: list[str] = Field(default_factory=list)


class EvaluationTestSetRecord(BaseModel):
    id: str
    name: str
    description: str = ""
    datasource_bindings: list[EvaluationTestSetDatasourceBindingStored] = Field(
        default_factory=list
    )
    start: str
    end: str
    stock_codes: list[str] = Field(default_factory=list)
    quantiles: int = 5
    is_default: bool = False
    created_at: str
    updated_at: str


class EvaluationTestSetsFile(BaseModel):
    version: int = 2
    items: list[EvaluationTestSetRecord] = Field(default_factory=list)


class EvaluationTestSetDatasourceBindingInput(BaseModel):
    datasource_id: str
    dependencies: list[str] = Field(default_factory=list)

    @field_validator("dependencies", mode="before")
    @classmethod
    def _strip_deps(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("dependencies must be a list")
        return [str(x).strip() for x in v if str(x).strip()]


class EvaluationTestSetCreate(BaseModel):
    name: str
    description: str = ""
    datasource_bindings: list[EvaluationTestSetDatasourceBindingInput]
    start: str
    end: str
    stock_codes: list[str] = Field(default_factory=list)
    quantiles: int = 5
    is_default: bool = False

    @field_validator("stock_codes", mode="before")
    @classmethod
    def _strip_codes(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("stock_codes must be a list")
        return [str(x).strip() for x in v if str(x).strip()]

    def to_record(self) -> EvaluationTestSetRecord:
        now = utc_now_iso()
        rid = str(uuid4())
        bindings = [
            EvaluationTestSetDatasourceBindingStored(
                datasource_id=b.datasource_id.strip(),
                dependencies=list(b.dependencies),
            )
            for b in self.datasource_bindings
        ]
        return EvaluationTestSetRecord(
            id=rid,
            name=self.name.strip(),
            description=(self.description or "").strip(),
            datasource_bindings=bindings,
            start=self.start.strip(),
            end=self.end.strip(),
            stock_codes=[c.strip() for c in self.stock_codes if str(c).strip()],
            quantiles=max(2, int(self.quantiles)),
            is_default=self.is_default,
            created_at=now,
            updated_at=now,
        )


class EvaluationTestSetPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    datasource_bindings: Optional[list[EvaluationTestSetDatasourceBindingInput]] = None
    start: Optional[str] = None
    end: Optional[str] = None
    stock_codes: Optional[list[str]] = None
    quantiles: Optional[int] = None
    is_default: Optional[bool] = None


class EvaluationTestSetDatasourceBindingPublic(BaseModel):
    datasource_id: str
    datasource_name: str
    datasource_type: str
    dependencies: list[str]


class EvaluationTestSetPublic(BaseModel):
    id: str
    name: str
    description: str
    datasource_bindings: list[EvaluationTestSetDatasourceBindingPublic]
    start: str
    end: str
    stock_codes: list[str]
    quantiles: int
    is_default: bool
    created_at: str
    updated_at: str
