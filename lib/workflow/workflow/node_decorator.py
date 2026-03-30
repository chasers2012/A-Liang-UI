"""Declarative socket metadata for classes participating in a workflow graph."""

from __future__ import annotations

import inspect
import types
from collections.abc import Callable
from typing import TypeVar

from .node_types import Node, NodeParam, Socket

_T = TypeVar("_T")


def workflow_node_type_key(cls: type) -> str:
    """Stable string id for a node class: ``module.qualname`` (used as :attr:`Node.type`)."""
    mod = getattr(cls, "__module__", None) or ""
    qn = getattr(cls, "__qualname__", None) or getattr(cls, "__name__", "") or ""
    return f"{mod}.{qn}" if mod else qn


def workflow_socket(
    name: str,
    *,
    required: bool = False,
    value_type: str = "any",
) -> Socket:
    """Build a :class:`Socket` for ``@workflow_node`` ``input_sockets`` / ``output_sockets``."""
    return Socket(name=name, required=required, value_type=value_type)


def _socket_tuple(sockets: list[Socket]) -> tuple[Socket, ...]:
    return tuple(s for s in sockets if (s.name or "").strip())


def workflow_node(
    *,
    input_sockets: list[Socket],
    output_sockets: list[Socket],
    workflow_parameters: list[NodeParam] | None = None,
    entry: str = "execute",
    label: str = "",
    description: str = "",
) -> Callable[[type[_T]], type[_T]]:
    """Attach graph I/O metadata and a ``__node_spec__()`` classmethod.

    The node type string is :func:`workflow_node_type_key` (``module.qualname``);
    decorated classes are discovered by :func:`collect_node_classes`.

    If ``entry="evaluate"`` (typical for evaluation metric classes), use
    :func:`handler_from_node_class`: it calls ``evaluate(clean_factor, **kwargs)``
    instead of ``execute(**kwargs)`` (merged node params, root inputs, and linked
    sockets). Expect an input socket named
    ``clean_factor``. Optional **classmethods** on the node class:

    - ``workflow_validate_clean_factor(value)``
    - ``workflow_metric_kwargs(node, inputs)`` -> ``dict`` used as ``**kwargs``
    - ``workflow_publish_evaluate_result(node, inputs, raw, primary_socket)``
      -> ``dict`` merged into handler outputs

    **Return values** (see :func:`~workflow.executor.handler_from_node_class`): prefer a
    ``tuple`` with one element per declared output socket in order (including a
    one-element tuple when there is a single output). A plain ``dict`` (keys =
    output socket names) is still accepted. Non-``dict`` mappings (e.g.
    :class:`pandas.Series`) are not treated as socket-keyed outputs.
    """

    input_specs = _socket_tuple(input_sockets)
    output_specs = _socket_tuple(output_sockets)
    _wp = workflow_parameters if workflow_parameters is not None else []
    param_specs: tuple[NodeParam, ...] = tuple(p for p in _wp if (p.key or "").strip())

    def decorate(cls: type[_T]) -> type[_T]:
        cls.INPUT_SOCKETS = list(input_sockets)  # type: ignore[attr-defined]
        cls.OUTPUT_SOCKETS = list(output_sockets)  # type: ignore[attr-defined]
        cls.WORKFLOW_PARAMETERS = list(_wp)  # type: ignore[attr-defined]
        cls.ENTRY = entry  # type: ignore[attr-defined]
        cls.WORKFLOW_LABEL = label  # type: ignore[attr-defined]
        cls.WORKFLOW_DESCRIPTION = description  # type: ignore[attr-defined]

        @classmethod  # type: ignore[misc]
        def __node_spec__(
            klass,
            *,
            label: str = "",
            description: str = "",
            default_inputs: tuple[Socket, ...] | None = None,
            default_outputs: tuple[Socket, ...] | None = None,
        ) -> Node:
            return Node(
                type=workflow_node_type_key(klass),
                label=label or klass.WORKFLOW_LABEL,
                description=description or klass.WORKFLOW_DESCRIPTION,
                inputs=input_specs if input_specs else (default_inputs or ()),
                outputs=output_specs if output_specs else (default_outputs or ()),
                parameters=param_specs,
            )

        cls.__node_spec__ = __node_spec__  # type: ignore[attr-defined]
        return cls

    return decorate


def _is_workflow_node_class(obj: type) -> bool:
    return bool(
        getattr(obj, "__node_spec__", None) is not None
        and getattr(obj, "INPUT_SOCKETS", None) is not None
        and getattr(obj, "OUTPUT_SOCKETS", None) is not None
    )


def _import_package_submodules(module: types.ModuleType) -> None:
    if not hasattr(module, "__path__"):
        return
    import importlib
    import pkgutil

    for info in pkgutil.iter_modules(module.__path__, module.__name__ + "."):
        importlib.import_module(info.name)


def _classes_from_module(mod: types.ModuleType, add: Callable[[type], None]) -> None:
    for _name, obj in inspect.getmembers(mod, inspect.isclass):
        add(obj)


def collect_node_classes(module: types.ModuleType) -> dict[str, type]:
    """Scan *module* for ``@workflow_node``-decorated classes.

    Keys are :func:`workflow_node_type_key` (``module.qualname``).

    If *module* is a package its direct sub-modules are imported first so that
    all node files participate in the scan.
    """
    _import_package_submodules(module)

    out: dict[str, type] = {}

    def _add(obj: type) -> None:
        if not _is_workflow_node_class(obj):
            return
        key = workflow_node_type_key(obj)
        if key not in out:
            out[key] = obj

    _classes_from_module(module, _add)

    if not hasattr(module, "__path__"):
        return out
    import sys

    prefix = module.__name__ + "."
    for sub_name, sub_mod in list(sys.modules.items()):
        if sub_mod is None or not sub_name.startswith(prefix):
            continue
        _classes_from_module(sub_mod, _add)

    return out
