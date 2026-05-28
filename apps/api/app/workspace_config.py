"""Load and save Pydantic models from workspace JSON files."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel
from workspace import workspace_path

T = TypeVar("T", bound=BaseModel)


def workspace_config_path(filename: str) -> Path:
    """Resolve *filename* under workspace ``config/``, ensuring parent directory exists."""
    normalized = str(filename or "").strip().lstrip("/\\")
    path = workspace_path(f"config/{normalized}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _legacy_workspace_config_path(filename: str) -> Path:
    """Legacy location (workspace root) kept for one-way read compatibility."""
    normalized = str(filename or "").strip().lstrip("/\\")
    return workspace_path(normalized)


def load_workspace_config(
    filename: str,
    model_type: type[T],
    *,
    default_factory: Callable[[], T],
) -> T:
    """
    Read *filename* relative to workspace root.

    Missing or whitespace-only file yields *default_factory*().
    Invalid JSON raises ``json.JSONDecodeError``.
    """
    path = workspace_config_path(filename)
    if not path.is_file():
        legacy_path = _legacy_workspace_config_path(filename)
        if legacy_path.is_file():
            path = legacy_path
        else:
            return default_factory()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return default_factory()
    try:
        data: Any = json.loads(raw)
    except json.JSONDecodeError:
        raise
    if not isinstance(data, dict):
        raise ValueError(f"{filename}: expected JSON object")
    return model_type.model_validate(data)


def save_workspace_config(
    filename: str,
    model: BaseModel,
    *,
    model_dump_kwargs: dict[str, Any] | None = None,
) -> None:
    path = workspace_config_path(filename)
    kwargs = model_dump_kwargs or {}
    path.write_text(
        json.dumps(model.model_dump(**kwargs), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
