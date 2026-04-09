from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.common.id import create_id_generator
from app.datasource.schemas import utc_now_iso

generate_id = create_id_generator("data_sets")


class DataSetDatasourceBindingStored(BaseModel):
    """Maps one enabled datasource to the logical dependency fields it provides."""

    datasource_id: str
    dependencies: list[str] = Field(default_factory=list)
    alias: dict[str, str] | None = None
    date_column: str = ""
    asset_column: str = ""


class DataSetRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    datasource_bindings: list[DataSetDatasourceBindingStored] = Field(default_factory=list)
    start: str
    end: str
    stock_codes: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class DataSetsFile(BaseModel):
    version: int = 2
    items: list[DataSetRecord] = Field(default_factory=list)


class DataSetDatasourceBindingInput(BaseModel):
    datasource_id: str
    dependencies: list[str] = Field(default_factory=list)
    alias: dict[str, str] | None = None
    date_column: str = ""
    asset_column: str = ""

    @field_validator("dependencies", mode="before")
    @classmethod
    def _strip_deps(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("dependencies must be a list")
        return [str(x).strip() for x in v if str(x).strip()]

    @field_validator("alias", mode="before")
    @classmethod
    def _normalize_alias(cls, v: object) -> dict[str, str] | None:
        if v is None:
            return None
        if not isinstance(v, dict):
            raise TypeError("alias must be a dict")
        out: dict[str, str] = {}
        for k, val in v.items():
            kk = str(k).strip()
            vv = str(val).strip()
            if not kk or not vv:
                continue
            out[kk] = vv
        return out or None

    @field_validator("date_column", "asset_column", mode="before")
    @classmethod
    def _strip_index_cols(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class DataSetCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    description: str = ""
    datasource_bindings: list[DataSetDatasourceBindingInput]
    start: str
    end: str
    stock_codes: list[str] = Field(default_factory=list)

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
        rid = str(generate_id())
        bindings = [
            DataSetDatasourceBindingStored(
                datasource_id=b.datasource_id.strip(),
                dependencies=list(b.dependencies),
                alias=(dict(b.alias) if b.alias else None),
                date_column=b.date_column.strip(),
                asset_column=b.asset_column.strip(),
            )
            for b in self.datasource_bindings
        ]
        return DataSetRecord(
            id=rid,
            name=self.name.strip(),
            description=(self.description or "").strip(),
            datasource_bindings=bindings,
            start=self.start.strip(),
            end=self.end.strip(),
            stock_codes=[c.strip() for c in self.stock_codes if str(c).strip()],
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


class DataSetDatasourceBindingPublic(BaseModel):
    datasource_id: str
    datasource_name: str
    datasource_type: str
    dependencies: list[str]
    alias: dict[str, str] | None = None
    date_column: str
    asset_column: str


class DataSetPublic(BaseModel):
    id: str
    name: str
    description: str
    datasource_bindings: list[DataSetDatasourceBindingPublic]
    start: str
    end: str
    stock_codes: list[str]
    created_at: str
    updated_at: str
