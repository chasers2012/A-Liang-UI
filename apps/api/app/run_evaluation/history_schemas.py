from __future__ import annotations

from pydantic import BaseModel, Field

from app.run_evaluation.schemas import FactorEvaluationWindow


class FactorEvaluationHistoryEntry(BaseModel):
    id: str
    linked_snapshot_id: str | None = None
    evaluated_at: str
    window: FactorEvaluationWindow | None = None
    stock_count: int | None = None
    mean_ic: dict[str, float] = Field(default_factory=dict)
    mean_return_spread: dict[str, float] = Field(default_factory=dict)
    error: str | None = None


class FactorEvaluationHistoryFile(BaseModel):
    version: int = 1
    items: dict[str, list[FactorEvaluationHistoryEntry]] = Field(default_factory=dict)
