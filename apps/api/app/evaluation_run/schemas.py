from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FactorEvaluationRecord(BaseModel):
    evaluated_at: str
    error: str | None = None
    evaluation_profile_id: str | None = None
    results: Any = None


class FactorEvaluationsFile(BaseModel):
    version: int = 1
    items: dict[str, FactorEvaluationRecord] = Field(default_factory=dict)


class FactorEvaluationRowPublic(BaseModel):
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


class FactorEvaluationsAggregatePublic(BaseModel):
    total_factors: int
    evaluated_count: int
    unevaluated_count: int
    primary_period: str
    mean_ic_primary_avg: float | None = None


class FactorEvaluationsSummaryPublic(BaseModel):
    aggregate: FactorEvaluationsAggregatePublic
    rows: list[FactorEvaluationRowPublic]
