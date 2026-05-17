"""In-process SSE event bus shared across business modules.

Public surface:
    - ``event_bus``: process-wide :class:`EventBus` singleton.
    - ``EventEnvelope``: pydantic schema for wire payload.

Limitation: this is an in-memory broker; if the API is ever deployed with
multiple uvicorn workers or the scheduler worker is moved to a separate
process, switch the implementation in ``bus.py`` to a Redis pub/sub style
broker. The ``publish`` / ``publish_threadsafe`` surface is the only thing
business code depends on.
"""

from __future__ import annotations

from .bus import EventBus, event_bus
from .schemas import EventEnvelope

__all__ = ["EventBus", "EventEnvelope", "event_bus"]
