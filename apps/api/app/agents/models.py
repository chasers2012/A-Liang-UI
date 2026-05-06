from __future__ import annotations

from sqlmodel import Field, SQLModel


class SubagentToolBindingRow(SQLModel, table=True):
    __tablename__ = "subagent_tool_bindings"

    subagent_id: str = Field(primary_key=True, index=True)
    tool_id: str = Field(primary_key=True, index=True)
    updated_at: str
