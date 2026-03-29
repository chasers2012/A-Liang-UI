from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FactorEvaluationWindow(BaseModel):
    start: str | None = None
    end: str | None = None


class FactorEvaluationSnapshot(BaseModel):
    evaluated_at: str
    window: FactorEvaluationWindow | None = None
    stock_count: int | None = None
    mean_ic: dict[str, float] = Field(default_factory=dict)
    mean_return_spread: dict[str, float] = Field(default_factory=dict)
    error: str | None = None
    evaluation_profile_id: str | None = None
    metric_results: dict[str, Any] = Field(default_factory=dict)


class FactorEvaluationsFile(BaseModel):
    version: int = 1
    items: dict[str, FactorEvaluationSnapshot] = Field(default_factory=dict)


class FactorEvaluationRowPublic(BaseModel):
    factor_id: str
    name: str
    has_evaluation: bool
    evaluated_at: str | None = None
    window: FactorEvaluationWindow | None = None
    stock_count: int | None = None
    mean_ic: dict[str, float] = Field(default_factory=dict)
    mean_return_spread: dict[str, float] = Field(default_factory=dict)
    error: str | None = None
    evaluation_profile_id: str | None = Field(
        default=None,
        description="Evaluation profile id when this snapshot used a named profile.",
    )
    metric_results: dict[str, Any] = Field(
        default_factory=dict,
        description="Per workflow node id: output socket name to JSON-serializable payload.",
    )


class FactorEvaluationsAggregatePublic(BaseModel):
    total_factors: int
    evaluated_count: int
    unevaluated_count: int
    primary_period: str
    mean_ic_primary_avg: float | None = None


class FactorEvaluationsSummaryPublic(BaseModel):
    aggregate: FactorEvaluationsAggregatePublic
    rows: list[FactorEvaluationRowPublic]


class FactorEvaluationRunBody(BaseModel):
    data_set_id: str | None = None
    evaluation_profile_id: str | None = None
