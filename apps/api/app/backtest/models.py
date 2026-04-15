from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


class BacktestRunRow(SQLModel, table=True):
    __tablename__ = "backtest_runs"

    id: str = Field(primary_key=True)
    strategy_id: str = Field(index=True)
    data_set_id: str = Field(index=True)

    status: str = Field(default="queued", index=True)
    queued_at: datetime
    start_at: datetime | None = None
    end_at: datetime | None = None

    params: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JsonText))
    error: str | None = None
    results: Any = Field(default=None, sa_column=Column(JsonText))
