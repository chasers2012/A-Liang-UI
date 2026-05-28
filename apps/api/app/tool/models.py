from __future__ import annotations

from enum import Enum

from sqlmodel import Field, SQLModel


class ToolAuthorization(str, Enum):
    disabled = "disabled"
    need_authorize = "need authorize"
    allowed = "allowed"


class ChatToolRow(SQLModel, table=True):
    __tablename__ = "chat_tools"

    id: str = Field(primary_key=True)
    name: str = ""
    category: str = ""
    updated_at: str
    authorization: ToolAuthorization = ToolAuthorization.need_authorize
