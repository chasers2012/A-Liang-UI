"""Wire schema for SSE events."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EventEnvelope(BaseModel):
    """SSE ``data:`` JSON payload (topic is sent separately as ``event:``)."""

    id: int
    ts: datetime = Field(default_factory=_now)
    data: dict[str, Any]
