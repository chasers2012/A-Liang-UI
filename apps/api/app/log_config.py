from __future__ import annotations

import logging
import os
from contextlib import suppress
from logging.handlers import RotatingFileHandler
from pathlib import Path

from workspace import workspace_path

DEFAULT_LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"


def get_log_directory() -> Path:
    return workspace_path("logs", "api")


def configure_logging() -> Path:
    log_dir = get_log_directory()
    log_dir.mkdir(parents=True, exist_ok=True)

    log_file = log_dir / os.getenv("API_LOG_FILE", "api.log")
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    max_bytes = int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024)))
    backup_count = int(os.getenv("LOG_BACKUP_COUNT", "10"))
    formatter = logging.Formatter(DEFAULT_LOG_FORMAT)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)
        with suppress(Exception):
            handler.close()

    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)

    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True
        logger.setLevel(log_level)

    logging.getLogger(__name__).info("API logging initialized: %s", log_file)
    return log_file
