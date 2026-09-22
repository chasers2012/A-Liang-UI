from __future__ import annotations

from sqlmodel import Column, Field, SQLModel

from app.infra.persistence.sql_types import JsonText


class FactorRow(SQLModel, table=True):
    __tablename__ = "factors"

    id: str = Field(primary_key=True)
    name: str
    group: str
    description: str
    is_plugin: bool = False
    dependencies: list[str] = Field(default_factory=list, sa_column=Column(JsonText))
    source_path: str
    created_at: str
    updated_at: str
