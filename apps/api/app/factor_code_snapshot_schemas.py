from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

FactorCodeSnapshotKind = Literal["auto", "manual"]


class FactorCodeSnapshotMeta(BaseModel):
    name: str
    group: str
    group_label: str
    description: str
    max_window: int
    dependencies: list[str] = Field(default_factory=list)


class FactorCodeSnapshot(BaseModel):
    id: str
    saved_at: str
    kind: FactorCodeSnapshotKind
    label: Optional[str] = None
    source: str
    meta: FactorCodeSnapshotMeta


class FactorCodeSnapshotSummaryPublic(BaseModel):
    id: str
    saved_at: str
    kind: FactorCodeSnapshotKind
    label: Optional[str] = None
    meta: FactorCodeSnapshotMeta


class FactorCodeSnapshotDetailPublic(FactorCodeSnapshotSummaryPublic):
    source: str


class FactorCodeSnapshotsFile(BaseModel):
    version: int = 1
    factors: dict[str, list[FactorCodeSnapshot]] = Field(default_factory=dict)
