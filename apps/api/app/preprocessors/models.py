from __future__ import annotations

from sqlmodel import Field, SQLModel


class PreprocessorRow(SQLModel, table=True):
    __tablename__ = "preprocessors"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    source_path: str
    created_at: str
    updated_at: str
