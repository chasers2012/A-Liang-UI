"""DAG workflow execution: topological order, link wiring, type-keyed handlers."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from .graph import WorkflowGraph, WorkflowLink, WorkflowNode
from .graph_algo import topological_order

NodeHandler = Callable[[WorkflowNode, Mapping[str, Any], Any], Mapping[str, Any]]


def handler_from_node_class(cls: type) -> NodeHandler:
    """Create a :data:`NodeHandler` from a ``@workflow_node``-decorated class.

    Each invocation instantiates the class and calls its *ENTRY* method
    (defaults to ``"execute"``).
    """
    entry_name: str = getattr(cls, "ENTRY", "execute")

    def _handler(
        node: WorkflowNode,
        inputs: Mapping[str, Any],
        ctx: Any,
    ) -> Mapping[str, Any]:
        return getattr(cls(), entry_name)(node, inputs, ctx)  # type: ignore[no-any-return]

    return _handler


class WorkflowUnknownNodeTypeError(LookupError):
    """Raised when ``node.type`` has no registered handler."""

    def __init__(self, node_id: str, node_type: str) -> None:
        self.node_id = node_id
        self.node_type = node_type
        super().__init__(f"unknown workflow node type {node_type!r} for node {node_id!r}")


def gather_node_inputs(
    links: Sequence[WorkflowLink],
    outputs: Mapping[str, Mapping[str, Any]],
    to_node_id: str,
) -> dict[str, Any]:
    """Build input socket values for ``to_node_id`` from upstream ``outputs``."""
    inputs: dict[str, Any] = {}
    for link in links:
        if link.to_node != to_node_id:
            continue
        bucket = outputs.get(link.from_node)
        if bucket is None:
            raise KeyError(link.from_node)
        if link.from_socket not in bucket:
            raise KeyError(link.from_socket)
        inputs[link.to_socket] = bucket[link.from_socket]
    return inputs


class WorkflowExecutor:
    def __init__(self, handlers: Mapping[str, NodeHandler]) -> None:
        self._handlers = dict(handlers)

    def execute(
        self,
        workflow: WorkflowGraph,
        *,
        context: Any = None,
    ) -> dict[str, dict[str, Any]]:
        """Run the workflow; return ``node_id -> {output_socket: value}``."""
        if not workflow.nodes:
            return {}
        order = topological_order(workflow.nodes, workflow.links)
        by_id = {n.id: n for n in workflow.nodes}
        out: dict[str, dict[str, Any]] = {}
        for nid in order:
            node = by_id[nid]
            nt = node.type
            handler = self._handlers.get(nt)
            if handler is None:
                raise WorkflowUnknownNodeTypeError(nid, nt)
            inputs = gather_node_inputs(workflow.links, out, nid)
            node_out = handler(node, inputs, context)
            out[nid] = dict(node_out)
        return out
