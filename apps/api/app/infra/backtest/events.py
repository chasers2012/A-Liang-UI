"""Helpers for publishing backtest run lifecycle events."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.infra.events import event_bus

if TYPE_CHECKING:
    from app.packages.backtest.models import BacktestRunRow

_RUN_TOPIC = "backtest.run.updated"


def emit_run_event(row: "BacktestRunRow", *, deleted: bool = False) -> None:
    """Publish a ``backtest.run.updated`` event for the given row.

    The payload mirrors :class:`BacktestRunSummary` keys (without joined
    metadata like ``strategy_name`` / ``data_set_name`` which require extra DB
    lookups; the frontend already keeps its own resolution cache).
    """
    payload = {
        "id": row.id,
        "strategy_id": row.strategy_id,
        "data_set_id": row.data_set_id,
        "status": row.status,
        "queued_at": row.queued_at.isoformat() if row.queued_at else None,
        "start_at": row.start_at.isoformat() if row.start_at else None,
        "end_at": row.end_at.isoformat() if row.end_at else None,
        "error": row.error,
        "deleted": deleted,
    }
    event_bus.publish_threadsafe(_RUN_TOPIC, payload)
