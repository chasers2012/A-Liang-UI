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
    """按系统本地时区解释 cron 五段，返回 UTC 供存储与比较。"""
    ref = base_time or utcnow()
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)
    anchor_local = ref.astimezone()
    next_local = croniter(cron_expr, anchor_local).get_next(datetime)
    return next_local.astimezone(timezone.utc)


def retry_backoff_seconds(attempt: int) -> int:
    # 2, 4, 8, 16, ... capped at 1 hour.
    return min(3600, 2 ** max(1, attempt))


def next_retry_time(attempt: int, *, base_time: datetime | None = None) -> datetime:
    return (base_time or utcnow()) + timedelta(seconds=retry_backoff_seconds(attempt))
