"""SSE endpoint for the global event bus."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from .bus import event_bus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["events"])


@router.get("/events")
async def stream_events(request: Request) -> EventSourceResponse:
    """SSE stream that broadcasts every business event.

    Wire format: ``event:`` = topic, ``data:`` = JSON-serialized
    :class:`EventEnvelope` (id, ts, data). Browser ``EventSource`` dispatches by ``event``.
    """

    async def event_generator():
        # Flush the stream immediately so clients / proxies do not sit idle until
        # the first business event (sse-starlette ping sleeps 15s before its first send).
        yield {"comment": "connected"}

        async for message in event_bus.subscribe():
            if await request.is_disconnected():
                break
            yield {
                "event": message.topic,
                "id": str(message.envelope.id),
                "data": message.envelope.model_dump_json(),
            }

    return EventSourceResponse(
        event_generator(),
        ping=30,
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        },
    )
