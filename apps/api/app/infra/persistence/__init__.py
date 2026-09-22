"""Persistence layer bootstrap."""

from __future__ import annotations

from .sqlite_db import create_db_and_tables
from app.startup_jobs import register_startup_job


@register_startup_job
def init_sqlite_persistence() -> None:
    create_db_and_tables()
