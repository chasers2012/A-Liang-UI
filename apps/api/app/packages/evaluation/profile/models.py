from __future__ import annotations

from sqlmodel import Field, SQLModel


class EvaluationProfileRow(SQLModel, table=True):
    __tablename__ = "evaluation_profiles"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    workflow: str
    created_at: str
    updated_at: str
