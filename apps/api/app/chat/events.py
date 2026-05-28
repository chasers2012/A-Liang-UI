"""SSE event models for chat streaming."""

from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel

StreamEventPayloadT = TypeVar("StreamEventPayloadT")

EventType = Literal["message_ids", "delta", "reasoning", "tool", "done", "error"]


class TextPayload(BaseModel):
    text: str
    #: LangGraph v2 stream ``ns``（子图 / 并行分支路径），用于区分并行流。
    run_segment_id: str | None = None


class ToolPayload(BaseModel):
    stage: Literal["start", "result", "error", "authorize"]
    # Name/args are carried on start and authorize so the client can render
    # the tool call context even when execution is paused for HITL.
    name: str | None = None
    id: str
    args: Any | None = None
    result: Any | None = None
    error: str | None = None
    run_segment_id: str | None = None


class MessageIdsPayload(BaseModel):
    user: str
    assistant: str


class StreamEvent(BaseModel, Generic[StreamEventPayloadT]):
    """Chat stream event: ``type`` discriminator + generic ``payload``."""

    type: EventType
    payload: StreamEventPayloadT


class MessageIdsEvent(StreamEvent[MessageIdsPayload]):
    type: Literal["message_ids"] = "message_ids"


class DeltaEvent(StreamEvent[TextPayload]):
    type: Literal["delta"] = "delta"


class ReasoningEvent(StreamEvent[TextPayload]):
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
