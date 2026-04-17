from __future__ import annotations

from datetime import datetime, timedelta, timezone

from croniter import croniter


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_cron_expr(cron_expr: str | None) -> str | None:
    if cron_expr is None:
        return None
    value = cron_expr.strip()
    return value or None


def validate_cron_expr(cron_expr: str | None) -> None:
    if cron_expr is None:
        return
    if not croniter.is_valid(cron_expr):
        raise ValueError("cron_expr 非法")


def next_cron_time(cron_expr: str, *, base_time: datetime | None = None) -> datetime:
    anchor = (base_time or utcnow()).astimezone(timezone.utc)
    return croniter(cron_expr, anchor).get_next(datetime)


def retry_backoff_seconds(attempt: int) -> int:
    # 2, 4, 8, 16, ... capped at 1 hour.
    return min(3600, 2 ** max(1, attempt))


def next_retry_time(attempt: int, *, base_time: datetime | None = None) -> datetime:
    return (base_time or utcnow()) + timedelta(seconds=retry_backoff_seconds(attempt))
