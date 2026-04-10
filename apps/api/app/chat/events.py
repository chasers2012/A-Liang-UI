"""SSE event models for chat streaming."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

EventType = Literal["message_ids", "delta", "tool", "done", "error"]


class ToolPayload(BaseModel):
    stage: Literal["start", "result", "error"]
    name: str
    id: str
    args: Any | None = None
    result: Any | None = None
    error: str | None = None


class MessageIdsPayload(BaseModel):
    user: str
    assistant: str


class MessageIdsEvent(BaseModel):
    type: Literal["message_ids"] = "message_ids"
    payload: MessageIdsPayload


class DeltaEvent(BaseModel):
    type: Literal["delta"] = "delta"
    payload: str


class ToolEvent(BaseModel):
    type: Literal["tool"] = "tool"
    payload: ToolPayload


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    payload: None = None


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    payload: str


StreamEvent = MessageIdsEvent | DeltaEvent | ToolEvent | DoneEvent | ErrorEvent
