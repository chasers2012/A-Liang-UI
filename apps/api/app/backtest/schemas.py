from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

BacktestRunStatus = Literal["queued", "running", "success", "failed", "cancelled"]


class BacktestRunRecord(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    strategy_id: str
    data_set_id: str
    status: BacktestRunStatus = "queued"
    queued_at: datetime
    start_at: datetime | None = None
    end_at: datetime | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    results: Any = None


class BacktestRunPublic(BaseModel):
    id: str
    strategy_id: str
    data_set_id: str
    status: BacktestRunStatus
    queued_at: datetime
    start_at: datetime | None = None
    end_at: datetime | None = None
    error: str | None = None
    # Summary payload for list/detail; charts fetched via dedicated endpoints.
    results: Any = None


class RunBacktestRequest(BaseModel):
    strategy_id: str
    data_set_id: str

    # Optional overrides
    start: str | None = None
    end: str | None = None

    initial_cash: float = 1_000_000.0
    fees: float = 0.0003
    slippage: float = 0.0000
    signal_lag: int = 1
    execution_price: Literal["close", "open"] = "close"


class BacktestEquityResponse(BaseModel):
    run_id: str
    equity_curve: list[dict[str, Any]] = Field(default_factory=list)


class BacktestTradesResponse(BaseModel):
    run_id: str
    trades: list[dict[str, Any]] = Field(default_factory=list)
