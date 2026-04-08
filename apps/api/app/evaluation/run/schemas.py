from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


class EvaluationRunRecord(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    start_at: datetime
    end_at: datetime
    factor_id: str

    error: str | None = None
    evaluation_profile_id: str | None = None
    results: Any = None


class EvaluationRunsFile(BaseModel):
    version: int = 1
    items: list[EvaluationRunRecord] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _normalize_legacy_items(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        items = data.get("items")
        if isinstance(items, dict):
            data = dict(data)
            data["items"] = list(items.values())
        return data


class EvaluationRunRowPublic(BaseModel):
    id: str | None = None
    factor_id: str
    name: str
    has_evaluation: bool
    evaluated_at: str | None = None
    error: str | None = None
    evaluation_profile_id: str | None = Field(
        default=None,
        description="Evaluation profile id when this run used a named profile.",
    )
    results: Any = None


class RunEvaluationRunRequest(BaseModel):
    profile_id: str
    factor_id: str


class EvaluationRunsAggregatePublic(BaseModel):
    total_factors: int
    evaluated_count: int
    unevaluated_count: int
    primary_period: str
    mean_ic_primary_avg: float | None = None


class EvaluationRunsSummaryPublic(BaseModel):
    aggregate: EvaluationRunsAggregatePublic
    rows: list[EvaluationRunRowPublic]


class EvaluationRunDetailPublic(BaseModel):
    id: str
    factor_id: str
    factor_name: str | None = None
    start_at: datetime
    end_at: datetime
    error: str | None = None
    evaluation_profile_id: str | None = None
    results: Any = None
