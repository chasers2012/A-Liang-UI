from __future__ import annotations

from typing import Any

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


class DataSetRow(SQLModel, table=True):
    __tablename__ = "data_sets"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    datasource_bindings: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JsonText),
    )
    preprocessing_workflow: str = ""
    start: str
    end: str
    instrument_codes: list[str] = Field(default_factory=list, sa_column=Column(JsonText))
    created_at: str
    updated_at: str
