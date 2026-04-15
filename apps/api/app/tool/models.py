from __future__ import annotations

from sqlmodel import Field, SQLModel


class ChatToolRow(SQLModel, table=True):
    __tablename__ = "chat_tools"

    id: str = Field(primary_key=True)
    category: str = ""
    updated_at: str
    disabled: bool = False
