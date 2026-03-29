"""Evaluation built-in node classes, specs, and handlers.

Use :data:`BUILTIN_NODE_SPECS` for the static node-type catalog and
:data:`BUILTIN_HANDLERS` for their :class:`~workflow.NodeHandler` map.
"""

from __future__ import annotations

from workflow import NodeHandler, NodeSpec, collect_node_classes, handler_from_node_class

from . import (
    prepare_alphalens,
    viz_auto,
    viz_bars,
    viz_bars_diverging,
    viz_json,
    viz_scalar,
    viz_table,
)

VIZ_NODE_TYPE_PREFIX = "viz_"

_ALL_MODULES = [
    prepare_alphalens,
    viz_auto,
    viz_bars,
    viz_bars_diverging,
    viz_json,
    viz_scalar,
    viz_table,
]

_NODE_CLASSES: dict[str, type] = {}
for _mod in _ALL_MODULES:
    _NODE_CLASSES.update(collect_node_classes(_mod))

BUILTIN_NODE_SPECS: dict[str, NodeSpec] = {
    tid: cls.__node_spec__()
    for tid, cls in _NODE_CLASSES.items()  # type: ignore[attr-defined]
}

BUILTIN_HANDLERS: dict[str, NodeHandler] = {
    tid: handler_from_node_class(cls) for tid, cls in _NODE_CLASSES.items()
}


def is_prepare_node_type(node_type: str) -> bool:
    return node_type == "prepare_alphalens"


def is_viz_node_type(node_type: str) -> bool:
    t = (node_type or "").strip()
    return t.startswith(VIZ_NODE_TYPE_PREFIX)


def sorted_viz_node_type_ids() -> list[str]:
    return sorted(tid for tid in BUILTIN_NODE_SPECS if is_viz_node_type(tid))


def builtin_node_definition(node_type: str) -> NodeSpec:
    return BUILTIN_NODE_SPECS[node_type]


def list_prepare_node_types() -> list[str]:
    return list(BUILTIN_NODE_SPECS.keys())
