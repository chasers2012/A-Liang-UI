from __future__ import annotations

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


class FactorRow(SQLModel, table=True):
    __tablename__ = "factors"

    id: str = Field(primary_key=True)
    name: str
    group: str
    description: str
    window: int = 1
    dependencies: list[str] = Field(default_factory=list, sa_column=Column(JsonText))
    source_path: str
    created_at: str
    updated_at: str
