from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FactorCodeSnapshotKind = Literal["auto", "manual"]


class FactorCodeSnapshotMeta(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    group: str
    description: str
    max_window: int
    dependencies: list[str] = Field(default_factory=list)


class FactorCodeSnapshot(BaseModel):
    id: str
    saved_at: str
    kind: FactorCodeSnapshotKind
    label: str | None = None
    source: str
    meta: FactorCodeSnapshotMeta


class FactorCodeSnapshotSummaryPublic(BaseModel):
    id: str
    saved_at: str
    kind: FactorCodeSnapshotKind
    label: str | None = None
    meta: FactorCodeSnapshotMeta


class FactorCodeSnapshotDetailPublic(FactorCodeSnapshotSummaryPublic):
    source: str


class FactorCodeSnapshotsFile(BaseModel):
    version: int = 1
    factors: dict[str, list[FactorCodeSnapshot]] = Field(default_factory=dict)
