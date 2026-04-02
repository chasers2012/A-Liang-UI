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


def _socket_tuple(sockets: list[Socket]) -> tuple[Socket, ...]:
    return tuple(s for s in sockets if (s.name or "").strip())


def workflow_node(
    *,
    input_sockets: list[Socket],
    output_sockets: list[Socket],
    workflow_parameters: list[NodeParam] | None = None,
    category: str = "",
    entry: str = "execute",
    label: str = "",
    description: str = "",
) -> Callable[[type[_T]], type[_T]]:
    """Return a wrapped subclass carrying workflow metadata.

    The node type string is :func:`workflow_node_type_key` (``module.qualname``).
    The returned class stores node-definition fields on class attributes:
    ``type``, ``label``, ``description``, ``inputs``, ``outputs``.
    ``workflow_parameters`` are appended to ``inputs`` (same tuple as wire sockets).

    If ``entry="evaluate"`` (typical for evaluation metric classes), use
    :func:`handler_from_node_class` with the class and its type-definition
    :class:`~workflow.node_types.Node` (from :func:`~workflow.node_registry.workflow_node_definition_from_class`
    or a registry entry's ``definition``): it calls ``evaluate(clean_factor, **kwargs)``
    instead of ``execute(**kwargs)`` (merged node params, root inputs, and linked
    sockets). Expect an input socket named
    ``clean_factor``. Optional **classmethods** on the node class:

    - ``workflow_validate_clean_factor(value)``
    - ``workflow_metric_kwargs(node, inputs)`` -> ``dict`` used as ``**kwargs``
    - ``workflow_publish_evaluate_result(node, inputs, raw, primary_socket)``
      -> ``dict`` merged into handler outputs

    **Return values** (see :func:`~workflow.executor.handler_from_node_class`): values map
    1:1 to ``output_sockets`` in order (``tuple``/``list``, or a scalar when there is
    a single output). ``output_sockets`` may be empty (side-effect-only node; handler
    output mapping is empty).
    """

    input_specs = _socket_tuple(input_sockets)
    output_specs = _socket_tuple(output_sockets)
    _wp = workflow_parameters if workflow_parameters is not None else []
    param_specs: tuple[NodeParam, ...] = tuple(
        p for p in _wp if (getattr(p, "name", None) or "").strip()
    )
    combined_inputs: tuple[Socket, ...] = input_specs + param_specs

    def decorate(cls: type[_T]) -> type[_T]:
        return type(  # type: ignore[return-value]
            cls.__name__,
            (cls, Node),
            {
                "__module__": cls.__module__,
                "__doc__": cls.__doc__,
                "__qualname__": cls.__qualname__,
                "__test__": False,
                "__init__": cls.__init__,
                "__annotations__": {
                    "type": str,
                    "label": str,
                    "description": str,
                    "category": str,
                    "entry": str,
                    "inputs": tuple[Socket, ...],
                    "outputs": tuple[Socket, ...],
                },
                "type": workflow_node_type_key(cls),
                "label": label,
                "description": description,
                "category": category,
                "entry": entry,
                "inputs": combined_inputs,
                "outputs": output_specs,
            },
        )

    return decorate


def _is_workflow_node_class(obj: type) -> bool:
    fields = getattr(obj, "model_fields", None)
    return bool(
        isinstance(obj, type)
        and issubclass(obj, Node)
        and isinstance(fields, dict)
        and "type" in fields
        and "inputs" in fields
        and "outputs" in fields
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
