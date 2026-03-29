"""Declarative metadata for workflow metric nodes (graph I/O + evaluation record hints)."""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

_T = TypeVar("_T")


def workflow_socket(
    name: str,
    *,
    required: bool = False,
    value_type: str = "any",
) -> dict[str, object]:
    """Build one entry for ``INPUT_SOCKETS`` / ``OUTPUT_SOCKETS`` on a metric class."""
    return {"name": name, "required": required, "value_type": value_type}


def workflow_node(
    *,
    input_sockets: list[dict[str, object]],
    output_sockets: list[dict[str, object]],
    record_field: str | None = None,
    visualization: dict[str, object] | None = None,
) -> Callable[[type[_T]], type[_T]]:
    """Attach workflow graph metadata to an evaluation metric class.

    Sets class attributes ``INPUT_SOCKETS``, ``OUTPUT_SOCKETS``, and optionally
    ``RECORD_FIELD`` and ``VISUALIZATION``.
    """

    def decorate(cls: type[_T]) -> type[_T]:
        cls.INPUT_SOCKETS = input_sockets  # type: ignore[attr-defined]
        cls.OUTPUT_SOCKETS = output_sockets  # type: ignore[attr-defined]
        if record_field is not None:
            cls.RECORD_FIELD = record_field  # type: ignore[attr-defined]
        if visualization is not None:
            cls.VISUALIZATION = visualization  # type: ignore[attr-defined]
        return cls

    return decorate
