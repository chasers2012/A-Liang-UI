"""Wire schema for SSE events."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EventEnvelope(BaseModel):
    """SSE wire payload.

    On the wire we use ``event:`` to carry ``topic`` and ``data:`` to carry
    the JSON-serialized envelope so the browser ``EventSource`` can dispatch
    by topic via ``addEventListener(topic, ...)``.
    """

    id: int
    topic: str
    ts: datetime = Field(default_factory=_now)
    data: dict[str, Any]
