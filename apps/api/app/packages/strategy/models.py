from __future__ import annotations

from sqlmodel import Field, SQLModel


class StrategyRow(SQLModel, table=True):
    __tablename__ = "strategies"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    workflow: str
    created_at: str
    updated_at: str
