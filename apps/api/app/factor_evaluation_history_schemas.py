from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.factor_evaluation_schemas import FactorEvaluationWindow


class FactorEvaluationHistoryEntry(BaseModel):
    id: str
    linked_snapshot_id: Optional[str] = None
    evaluated_at: str
    window: Optional[FactorEvaluationWindow] = None
    stock_count: Optional[int] = None
    mean_ic: dict[str, float] = Field(default_factory=dict)
    mean_return_spread: dict[str, float] = Field(default_factory=dict)
    error: Optional[str] = None


class FactorEvaluationHistoryFile(BaseModel):
    version: int = 1
    items: dict[str, list[FactorEvaluationHistoryEntry]] = Field(default_factory=dict)
