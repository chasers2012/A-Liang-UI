"""SSE event models for chat streaming."""

from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel

StreamEventPayloadT = TypeVar("StreamEventPayloadT")

EventType = Literal["message_ids", "delta", "reasoning", "tool", "done", "error"]


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


class StreamEvent(BaseModel, Generic[StreamEventPayloadT]):
    """Chat stream event: ``type`` discriminator + generic ``payload``."""

    type: EventType
    payload: StreamEventPayloadT


class MessageIdsEvent(StreamEvent[MessageIdsPayload]):
    type: Literal["message_ids"] = "message_ids"


class DeltaEvent(StreamEvent[str]):
    type: Literal["delta"] = "delta"


class ReasoningEvent(StreamEvent[str]):
    type: Literal["reasoning"] = "reasoning"


class ToolEvent(StreamEvent[ToolPayload]):
    type: Literal["tool"] = "tool"


class DoneEvent(StreamEvent[None]):
    type: Literal["done"] = "done"
    payload: None = None


class ErrorEvent(StreamEvent[str]):
    type: Literal["error"] = "error"


# Annotation for handlers that accept any concrete stream event.
StreamEventAny = StreamEvent[Any]
