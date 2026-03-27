"""Agent logging: console + rolling file under workspace."""

from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler

from workspace import ensure_dir

_LOGGER_NAME = "quant_agent.agent"
_initialized = False


def _parse_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw, 10)
    except ValueError:
        return default


def configure_agent_logging(
    *,
    level: int | None = None,
    max_bytes: int | None = None,
    backup_count: int | None = None,
) -> logging.Logger:
    """
    Configure ``quant_agent.agent`` loggers: console + ``logs/agent/agent.log`` under workspace.

    Idempotent: repeated calls do not duplicate handlers.

    Environment (optional, after ``load_dotenv``):
      FACTOR_AGENT_LOG_LEVEL       DEBUG/INFO/WARNING/ERROR, default INFO
      FACTOR_AGENT_LOG_MAX_BYTES   default 5242880 (5 MiB)
      FACTOR_AGENT_LOG_BACKUP_COUNT default 5
    """
    global _initialized
    logger = logging.getLogger(_LOGGER_NAME)
    if _initialized:
        return logger

    if level is None:
        name = os.environ.get("FACTOR_AGENT_LOG_LEVEL", "INFO").strip().upper()
        level = getattr(logging, name, logging.INFO)

    max_b = (
        max_bytes
        if max_bytes is not None
        else _parse_int("FACTOR_AGENT_LOG_MAX_BYTES", 5 * 1024 * 1024)
    )
    n_back = (
        backup_count if backup_count is not None else _parse_int("FACTOR_AGENT_LOG_BACKUP_COUNT", 5)
    )

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    log_dir = ensure_dir("logs", "agent")
    log_path = log_dir / "agent.log"
    file_h = RotatingFileHandler(
        str(log_path),
        maxBytes=max(1, max_b),
        backupCount=max(0, n_back),
        encoding="utf-8",
    )
    file_h.setLevel(level)
    file_h.setFormatter(fmt)

    console_h = logging.StreamHandler(sys.stderr)
    console_h.setLevel(level)
    console_h.setFormatter(fmt)

    logger.setLevel(level)
    logger.addHandler(file_h)
    logger.addHandler(console_h)
    logger.propagate = False

    _initialized = True
    logger.debug("Agent logging initialized, file=%s", log_path)
    return logger


def get_agent_logger(name: str | None = None) -> logging.Logger:
    """Child modules use ``get_agent_logger(__name__)``."""
    configure_agent_logging()
    if not name or name == _LOGGER_NAME:
        return logging.getLogger(_LOGGER_NAME)
    return logging.getLogger(name)
