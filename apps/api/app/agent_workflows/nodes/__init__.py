"""Agent built-in node classes, specs, and handlers.

Use :data:`AGENT_NODE_TYPES` for the static node-type catalog and
:data:`AGENT_HANDLERS` for their :class:`~workflow.NodeHandler` map.
"""

from __future__ import annotations

from workflow import NodeHandler, NodeSpec, collect_node_classes, handler_from_node_class

from . import (
    evaluate_node,
    finalize,
    generate_code,
    generate_pseudocode,
    ideate,
    init_context,
    validate_node,
)

_ALL_MODULES = [
    init_context,
    ideate,
    generate_pseudocode,
    generate_code,
    validate_node,
    evaluate_node,
    finalize,
]

_NODE_CLASSES: dict[str, type] = {}
for _mod in _ALL_MODULES:
    _NODE_CLASSES.update(collect_node_classes(_mod))

AGENT_NODE_SPECS: dict[str, NodeSpec] = {
    tid: cls.__node_spec__()
    for tid, cls in _NODE_CLASSES.items()  # type: ignore[attr-defined]
}

AGENT_NODE_TYPES: list[NodeSpec] = [
    AGENT_NODE_SPECS[tid]
    for tid in [
        "init_context",
        "ideate",
        "generate_pseudocode",
        "generate_code",
        "validate",
        "evaluate",
        "finalize",
    ]
]

AGENT_HANDLERS: dict[str, NodeHandler] = {
    tid: handler_from_node_class(cls) for tid, cls in _NODE_CLASSES.items()
}
