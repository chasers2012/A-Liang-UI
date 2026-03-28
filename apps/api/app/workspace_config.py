"""Load and save Pydantic models from workspace ``config/*.json`` files."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel
from workspace import ensure_dir, workspace_path

CONFIG_DIR = "config"

T = TypeVar("T", bound=BaseModel)


def workspace_config_path(filename: str) -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, filename)


def load_workspace_config(
    filename: str,
    model_type: type[T],
    *,
    default_factory: Callable[[], T],
    json_error_label: str | None = None,
    non_dict_returns_default: bool = False,
) -> T:
    """
    Read *filename* under ``config/``.

    Missing or whitespace-only file yields *default_factory*(). Invalid JSON
    raises ``ValueError`` when *json_error_label* is set (message prefix),
    otherwise ``json.JSONDecodeError``. When *non_dict_returns_default* is true,
    a non-object JSON root returns the default without validating.
    """
    path = workspace_config_path(filename)
    if not path.is_file():
        return default_factory()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return default_factory()
    try:
        data: Any = json.loads(raw)
    except json.JSONDecodeError as e:
        if json_error_label is not None:
            raise ValueError(f"{json_error_label}: invalid JSON ({e})") from e
        raise
    if non_dict_returns_default and not isinstance(data, dict):
        return default_factory()
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
