"""Declarative socket metadata for classes participating in a workflow graph."""

from __future__ import annotations

import inspect
import types
from collections.abc import Callable
from typing import TypeVar

from .node_spec import NodeSpec, SocketSpec

_T = TypeVar("_T")


def workflow_socket(
    name: str,
    *,
    required: bool = False,
    value_type: str = "any",
) -> dict[str, object]:
    """Build one entry for ``INPUT_SOCKETS`` / ``OUTPUT_SOCKETS`` on a decorated class."""
    return {"name": name, "required": required, "value_type": value_type}


def _dicts_to_socket_specs(raw: list[dict[str, object]]) -> tuple[SocketSpec, ...]:
    out: list[SocketSpec] = []
    for x in raw:
        name = x.get("name")
        if not name:
            continue
        out.append(
            SocketSpec(
                str(name),
                bool(x.get("required", False)),
                str(x.get("value_type", "any")),
            )
        )
    return tuple(out)


def workflow_node(
    *,
    input_sockets: list[dict[str, object]],
    output_sockets: list[dict[str, object]],
    entry: str = "execute",
    type_id: str = "",
    label: str = "",
    description: str = "",
) -> Callable[[type[_T]], type[_T]]:
    """Attach graph I/O metadata and a ``__node_spec__()`` classmethod.

    When ``type_id`` is provided the class fully self-describes a node type
    and can be discovered by :func:`collect_node_classes`.
    """

    input_specs = _dicts_to_socket_specs(input_sockets)
    output_specs = _dicts_to_socket_specs(output_sockets)

    def decorate(cls: type[_T]) -> type[_T]:
        cls.INPUT_SOCKETS = input_sockets  # type: ignore[attr-defined]
        cls.OUTPUT_SOCKETS = output_sockets  # type: ignore[attr-defined]
        cls.ENTRY = entry  # type: ignore[attr-defined]
        cls.WORKFLOW_TYPE_ID = type_id  # type: ignore[attr-defined]
        cls.WORKFLOW_LABEL = label  # type: ignore[attr-defined]
        cls.WORKFLOW_DESCRIPTION = description  # type: ignore[attr-defined]

        @classmethod  # type: ignore[misc]
        def __node_spec__(
            klass,
            *,
            type_id: str = "",
            label: str = "",
            description: str = "",
            default_inputs: tuple[SocketSpec, ...] | None = None,
            default_outputs: tuple[SocketSpec, ...] | None = None,
        ) -> NodeSpec:
            return NodeSpec(
                type=type_id or klass.WORKFLOW_TYPE_ID,
                label=label or klass.WORKFLOW_LABEL,
                description=description or klass.WORKFLOW_DESCRIPTION,
                inputs=input_specs if input_specs else (default_inputs or ()),
                outputs=output_specs if output_specs else (default_outputs or ()),
            )

        cls.__node_spec__ = __node_spec__  # type: ignore[attr-defined]
        return cls

    return decorate


def collect_node_classes(module: types.ModuleType) -> dict[str, type]:
    """Scan *module* for ``@workflow_node``-decorated classes that have a non-empty ``WORKFLOW_TYPE_ID``.

    If *module* is a package its direct sub-modules are imported first so that
    all node files participate in the scan.
    """
    if hasattr(module, "__path__"):
        import importlib
        import pkgutil

        for info in pkgutil.iter_modules(module.__path__, module.__name__ + "."):
            importlib.import_module(info.name)

    out: dict[str, type] = {}
    for _name, obj in inspect.getmembers(module, inspect.isclass):
        tid = getattr(obj, "WORKFLOW_TYPE_ID", None)
        if tid and isinstance(tid, str) and tid.strip():
            out[tid.strip()] = obj

    if hasattr(module, "__path__"):
        import sys

        for sub_name, sub_mod in list(sys.modules.items()):
            if sub_mod is None or not sub_name.startswith(module.__name__ + "."):
                continue
            for _name, obj in inspect.getmembers(sub_mod, inspect.isclass):
                tid = getattr(obj, "WORKFLOW_TYPE_ID", None)
                if tid and isinstance(tid, str) and tid.strip() and tid.strip() not in out:
                    out[tid.strip()] = obj

    return out
