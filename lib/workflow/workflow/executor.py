"""DAG workflow execution: topological order, link wiring, dynamic type resolution."""

from __future__ import annotations

import json
from typing import Any

from .graph_algo import topological_order
from .node_types import Node, WorkflowGraph
from .parser import Parser


class WorkflowUnknownNodeTypeError(LookupError):
    """Raised when ``node.type`` cannot be resolved to an executable workflow node class."""

    def __init__(self, node_id: str, node_type: str) -> None:
        self.node_id = node_id
        self.node_type = node_type
        super().__init__(f"unknown workflow node type {node_type!r} for node {node_id!r}")


def gather_node_inputs(
    graph: WorkflowGraph,
    node: Node,
    outputs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    links = graph.links
    to_node_id = node.id
    """Build input socket values for ``to_node_id`` from upstream ``outputs``."""
    inputs: dict[str, dict[str, Any]] = {}
    for link in links:
        if link.to_node != to_node_id:
            continue
        bucket = outputs.get(link.from_node)
        if bucket is None:
            raise KeyError(link.from_node)
        if link.from_socket not in bucket:
            raise KeyError(link.from_socket)
        if not inputs.get(link.to_socket):
            inputs[link.to_socket] = {}

        inputs[link.to_socket][f"{link.from_node}:{link.from_socket}"] = bucket[link.from_socket]

    appendable_inputs = {
        getattr(s, "name", "")
        for s in (getattr(node, "inputs", ()) or ())
        if getattr(s, "render_type", "") == "appendable" and getattr(s, "name", "")
    }

    ret: dict[str, Any] = {}
    for key, bucket in inputs.items():
        # Appendable sockets must keep the upstream mapping shape even when there is
        # only one link; they are ordered/selected by link identity.
        if key in appendable_inputs or len(bucket) != 1:
            ret[key] = bucket
            continue

        # Normal sockets: keep the original convenience unwrap for single input.
        ret[key] = next(iter(bucket.values()))

    return ret


def format_output(node: Node, output: tuple[Any, ...]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if output and len(node.outputs) == 0:
        out = output
    for i, socket in enumerate(node.outputs):
        out[socket.name] = output[i]
    return out


class WorkflowExecutor:
    """Execute workflows from JSON; resolves ``node.type`` via import (see :func:`resolve_workflow_node_class`)."""

    def execute(
        self,
        workflow: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, dict[str, Any]]:
        """Run the workflow from a JSON string; return ``node_id -> {output_socket: value}``.

        *workflow* must decode to a dict accepted by :meth:`Parser.parse_workflow_graph`
        (same shape as :meth:`WorkflowGraph.serialize`: ``nodes`` + ``links``).

        *context* keys are merged into each node's kwargs (before static ``params`` and
        link inputs, which override). The full mapping is also available under ``context``.

        Node implementations must be importable (e.g. workspace package parents on ``sys.path``).
        """
        payload = json.loads(workflow)
        if not isinstance(payload, dict):
            raise TypeError("workflow JSON must decode to an object")

        graph = Parser.parse_workflow_graph(payload)
        if not graph.nodes:
            return {}

        ctx = dict(context or {})
        order = topological_order(graph.nodes, graph.links)
        by_id = {n.id: n for n in graph.nodes}
        out: dict[str, dict[str, Any]] = {}
        for nid in order:
            node = by_id[nid]

            inputs = gather_node_inputs(graph, node, out)
            node_inputs = {**ctx, **node.params, **inputs}

            # 调用节点类的entry方法
            node_out = getattr(node, node.entry or "execute")(**node_inputs)

            out[nid] = format_output(node, node_out if isinstance(node_out, tuple) else (node_out,))
        return out
