from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class FactorEvaluationWindow(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None


class FactorEvaluationSnapshot(BaseModel):
    evaluated_at: str
    window: Optional[FactorEvaluationWindow] = None
    stock_count: Optional[int] = None
    mean_ic: dict[str, float] = Field(default_factory=dict)
    mean_return_spread: dict[str, float] = Field(default_factory=dict)
    error: Optional[str] = None
    evaluation_profile_id: Optional[str] = None
    metric_results: dict[str, Any] = Field(default_factory=dict)


class FactorEvaluationsFile(BaseModel):
    version: int = 1
    items: dict[str, FactorEvaluationSnapshot] = Field(default_factory=dict)


class FactorEvaluationRowPublic(BaseModel):
    factor_id: str
    name: str
    has_evaluation: bool
    evaluated_at: Optional[str] = None
    window: Optional[FactorEvaluationWindow] = None
    stock_count: Optional[int] = None
    mean_ic: dict[str, float] = Field(default_factory=dict)
    mean_return_spread: dict[str, float] = Field(default_factory=dict)
    error: Optional[str] = None
    evaluation_profile_id: Optional[str] = Field(
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
    mean_ic_primary_avg: Optional[float] = None


class FactorEvaluationsSummaryPublic(BaseModel):
    aggregate: FactorEvaluationsAggregatePublic
    rows: list[FactorEvaluationRowPublic]


class FactorEvaluationRunBody(BaseModel):
    test_set_id: Optional[str] = None
    evaluation_profile_id: Optional[str] = None
