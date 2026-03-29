from __future__ import annotations

from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.datasources.schemas import utc_now_iso


class DataSetDatasourceBindingStored(BaseModel):
    """Maps one enabled datasource to the logical dependency fields it provides."""

    datasource_id: str
    dependencies: list[str] = Field(default_factory=list)


class DataSetRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    datasource_bindings: list[DataSetDatasourceBindingStored] = Field(
        default_factory=list)
    start: str
    end: str
    stock_codes: list[str] = Field(default_factory=list)
    is_default: bool = False
    created_at: str
    updated_at: str


class DataSetsFile(BaseModel):
    version: int = 2
    items: list[DataSetRecord] = Field(default_factory=list)


class DataSetDatasourceBindingInput(BaseModel):
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


class DataSetCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    description: str = ""
    datasource_bindings: list[DataSetDatasourceBindingInput]
    start: str
    end: str
    stock_codes: list[str] = Field(default_factory=list)
    is_default: bool = False

    @field_validator("stock_codes", mode="before")
    @classmethod
    def _strip_codes(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("stock_codes must be a list")
        return [str(x).strip() for x in v if str(x).strip()]

    def to_record(self) -> DataSetRecord:
        now = utc_now_iso()
        rid = str(uuid4())
        bindings = [
            DataSetDatasourceBindingStored(
                datasource_id=b.datasource_id.strip(),
                dependencies=list(b.dependencies),
            ) for b in self.datasource_bindings
        ]
        return DataSetRecord(
            id=rid,
            name=self.name.strip(),
            description=(self.description or "").strip(),
            datasource_bindings=bindings,
            start=self.start.strip(),
            end=self.end.strip(),
            stock_codes=[
                c.strip() for c in self.stock_codes if str(c).strip()
            ],
            is_default=self.is_default,
            created_at=now,
            updated_at=now,
        )


class DataSetPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    datasource_bindings: list[DataSetDatasourceBindingInput] | None = None
    start: str | None = None
    end: str | None = None
    stock_codes: list[str] | None = None
    is_default: bool | None = None


class DataSetDatasourceBindingPublic(BaseModel):
    datasource_id: str
    datasource_name: str
    datasource_type: str
    dependencies: list[str]


class DataSetPublic(BaseModel):
    id: str
    name: str
    description: str
    datasource_bindings: list[DataSetDatasourceBindingPublic]
    start: str
    end: str
    stock_codes: list[str]
    is_default: bool
    created_at: str
    updated_at: str
