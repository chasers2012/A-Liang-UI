"""Process-local async event bus.

Subscribers receive every published event (broadcast fan-out). The bus is
thread-safe in the sense that worker threads can publish via
``publish_threadsafe`` which trampolines the publish coroutine onto the main
asyncio loop captured during application startup.

Single-process assumption: see ``apps/api/app/events/__init__.py``.
"""

from __future__ import annotations

import asyncio
import itertools
import logging
from collections.abc import AsyncIterator
from typing import Any

from .schemas import EventEnvelope

logger = logging.getLogger(__name__)

_QUEUE_MAXSIZE = 1024


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[EventEnvelope]] = set()
        self._lock = asyncio.Lock()
        self._id_seq = itertools.count(1)
        self._loop: asyncio.AbstractEventLoop | None = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Remember the main asyncio loop so threads can publish into it."""
        self._loop = loop

    async def subscribe(self) -> AsyncIterator[EventEnvelope]:
        """Async iterator yielding every event for this subscriber.

        Caller is responsible for breaking out of the loop on client
        disconnect; the queue is cleaned up via ``finally``.
        """
        queue: asyncio.Queue[EventEnvelope] = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        async with self._lock:
            self._subscribers.add(queue)
        try:
            while True:
                ev = await queue.get()
                yield ev
        finally:
            async with self._lock:
                self._subscribers.discard(queue)

    async def publish(self, topic: str, data: dict[str, Any]) -> None:
        """Publish an event from the asyncio loop."""
        envelope = EventEnvelope(id=next(self._id_seq), topic=topic, data=data)
        # Snapshot subscribers under lock; drop on slow consumers (full queue).
        async with self._lock:
            subscribers = list(self._subscribers)
        for queue in subscribers:
            try:
                queue.put_nowait(envelope)
            except asyncio.QueueFull:
                logger.warning(
                    "event bus subscriber queue full, dropping event topic=%s id=%s",
                    topic,
                    envelope.id,
                )

    def publish_threadsafe(self, topic: str, data: dict[str, Any]) -> None:
        """Publish an event from a worker thread.

        No-op if the main loop has not yet been attached (e.g. during early
        startup before lifespan); business modules should never depend on the
        event going through, the bus is best-effort.
        """
        loop = self._loop
        if loop is None or loop.is_closed():
            logger.debug("event bus has no loop; dropping topic=%s", topic)
            return
        try:
            asyncio.run_coroutine_threadsafe(self.publish(topic, data), loop)
        except RuntimeError as exc:
            logger.warning("failed to schedule event topic=%s: %s", topic, exc)


event_bus = EventBus()
