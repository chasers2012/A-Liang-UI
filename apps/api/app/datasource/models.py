from __future__ import annotations

from typing import Any

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


class DataSourceRow(SQLModel, table=True):
    __tablename__ = "datasources"

    id: str = Field(primary_key=True)
    name: str
    type: str
    config: dict[str, Any] | None = Field(default=None, sa_column=Column(JsonText))
    created_at: str
    updated_at: str
