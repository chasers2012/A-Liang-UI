"""SSE event models for chat streaming."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ToolEventPayload(BaseModel):
    name: str
    id: str
    args: Any | None = None
    result: Any | None = None
    error: str | None = None


class DeltaEvent(BaseModel):
    delta: str


class DoneEvent(BaseModel):
    done: bool = True


class ErrorEvent(BaseModel):
    error: str


class ToolStartEvent(BaseModel):
    tool_start: ToolEventPayload


class ToolResultEvent(BaseModel):
    tool_result: ToolEventPayload


class ToolErrorEvent(BaseModel):
    tool_error: ToolEventPayload


class MessageIdsPayload(BaseModel):
    user: str
    assistant: str


class StreamEventEnvelope(BaseModel):
    message_ids: MessageIdsPayload | None = None
    delta: str | None = None
    done: bool | None = None
    error: str | None = None
    tool_start: ToolEventPayload | None = None
    tool_result: ToolEventPayload | None = None
    tool_error: ToolEventPayload | None = None


def parse_sse_data_line(event: str) -> StreamEventEnvelope | None:
    if not event.startswith("data: "):
        return None
    raw = event.removeprefix("data: ").strip()
    if not raw:
        return None
    try:
        return StreamEventEnvelope.model_validate_json(raw)
    except Exception:
        return None
