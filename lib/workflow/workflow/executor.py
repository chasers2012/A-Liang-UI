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
    workflow_inputs: dict[str, Any],
    outputs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    links = graph.links
    to_node_id = node.id
    """Build input socket values for ``to_node_id`` from upstream ``outputs``."""
    inputs: dict[str, dict[str, Any]] = {}
    for link in links:
        if link.to.kind != "node" or link.to.node_id != to_node_id:
            continue
        upstream_value: Any
        upstream_key: str
        if link.from_.kind == "workflow_input":
            upstream_key = f"workflow_input:{link.from_.socket}"
            upstream_value = workflow_inputs.get(link.from_.socket)
        else:
            from_id = link.from_.node_id or ""
            bucket = outputs.get(from_id)
            if bucket is None:
                raise KeyError(from_id)
            if link.from_.socket not in bucket:
                raise KeyError(link.from_.socket)
            upstream_key = f"{from_id}:{link.from_.socket}"
            upstream_value = bucket[link.from_.socket]
        if not inputs.get(link.to.socket):
            inputs[link.to.socket] = {}

        inputs[link.to.socket][upstream_key] = upstream_value

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


def gather_workflow_outputs(
    graph: WorkflowGraph,
    workflow_inputs: dict[str, Any],
    outputs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    ret: dict[str, Any] = {}
    for socket in graph.workflow_outputs:
        name = getattr(socket, "name", "")
        if not name:
            continue
        matched = [
            link
            for link in graph.links
            if link.to.kind == "workflow_output" and link.to.socket == name
        ]
        if not matched:
            continue
        if len(matched) == 1:
            link = matched[0]
            if link.from_.kind == "workflow_input":
                ret[name] = workflow_inputs.get(link.from_.socket)
            else:
                from_id = link.from_.node_id or ""
                bucket = outputs.get(from_id, {})
                if link.from_.socket in bucket:
                    ret[name] = bucket[link.from_.socket]
            continue
        ret[name] = {}
        for link in matched:
            if link.from_.kind == "workflow_input":
                ret[name][f"workflow_input:{link.from_.socket}"] = workflow_inputs.get(
                    link.from_.socket
                )
                continue
            from_id = link.from_.node_id or ""
            ret[name][f"{from_id}:{link.from_.socket}"] = outputs.get(from_id, {}).get(
                link.from_.socket
            )
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
        workflow_inputs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Run the workflow from a JSON string.

        *workflow* must decode to a dict accepted by :meth:`Parser.parse_workflow_graph`
        (same shape as :meth:`WorkflowGraph.serialize`: ``nodes`` + ``links``).

        *context* keys are merged into each node's kwargs (before static ``params`` and
        link inputs, which override). The full mapping is also available under ``context``.
        ``workflow_inputs`` provides values for graph-level workflow input sockets.

        Node implementations must be importable (e.g. workspace package parents on ``sys.path``).
        """
        payload = json.loads(workflow)
        if not isinstance(payload, dict):
            raise TypeError("workflow JSON must decode to an object")

        graph = Parser.parse_workflow_graph(payload)
        workflow_inputs_dict = dict(workflow_inputs or {})
        workflow_inputs = {
            socket.name: workflow_inputs_dict.get(socket.name)
            for socket in graph.workflow_inputs
            if getattr(socket, "name", "")
        }
        if not graph.nodes:
            return {
                "nodes": {},
                "workflow_inputs": workflow_inputs,
                "workflow_outputs": gather_workflow_outputs(graph, workflow_inputs, {}),
            }

        ctx = dict(context or {})
        node_outputs: dict[str, dict[str, Any]] = {}
        order = topological_order(graph.nodes, graph.links)
        by_id = {n.id: n for n in graph.nodes}
        for nid in order:
            node = by_id[nid]

            inputs = gather_node_inputs(graph, node, workflow_inputs, node_outputs)
            appendable_input_names = {
                getattr(s, "name", "")
                for s in (getattr(node, "inputs", ()) or ())
                if getattr(s, "render_type", "") == "appendable" and getattr(s, "name", "")
            }
            inputs_for_merge = {
                k: v for k, v in inputs.items() if k in appendable_input_names or v is not None
            }
            node_inputs = {**ctx, **node.params, **inputs_for_merge}

            # 调用节点类的entry方法
            node_out = getattr(node, node.entry or "execute")(**node_inputs)

            node_outputs[nid] = format_output(
                node, node_out if isinstance(node_out, tuple) else (node_out,)
            )

        workflow_outputs = gather_workflow_outputs(graph, workflow_inputs, node_outputs)
        return {
            "nodes": node_outputs,
            "workflow_inputs": workflow_inputs,
            "workflow_outputs": workflow_outputs,
        }
