from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EvaluationRunsFile(BaseModel):
    version: int = 1
    items: list[dict[str, Any]] = Field(default_factory=list)


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
    data_set_id: str | None = Field(
        default=None,
        description="若提供，则覆盖方案中所有「加载数据集」节点的 data_set 参数。",
    )


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
