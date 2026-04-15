from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


class EvaluationRunRow(SQLModel, table=True):
    __tablename__ = "evaluation_runs"

    id: str = Field(primary_key=True)
    start_at: datetime
    end_at: datetime
    factor_id: str = Field(index=True)
    error: str | None = None
    evaluation_profile_id: str | None = Field(default=None, index=True)
    results: Any = Field(default=None, sa_column=Column(JsonText))
