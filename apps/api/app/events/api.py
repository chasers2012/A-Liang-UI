"""SSE endpoint for the global event bus."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.startup_jobs import register_startup_job

from .bus import event_bus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["events"])


@register_startup_job
async def _attach_event_loop() -> None:
    """Capture the running loop so worker threads can publish into it."""
    event_bus.attach_loop(asyncio.get_running_loop())


@router.get("/events")
async def stream_events(request: Request) -> EventSourceResponse:
    """SSE stream that broadcasts every business event.

    Wire format: ``event:`` = topic, ``data:`` = JSON-serialized
    :class:`EventEnvelope` so browser ``EventSource`` can dispatch by topic.
    """

    async def event_generator():
        # Flush the stream immediately so clients / proxies do not sit idle until
        # the first business event (sse-starlette ping sleeps 15s before its first send).
        yield {"comment": "connected"}

        async for envelope in event_bus.subscribe():
            if await request.is_disconnected():
                break
            yield {
                "event": envelope.topic,
                "id": str(envelope.id),
                "data": envelope.model_dump_json(),
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
