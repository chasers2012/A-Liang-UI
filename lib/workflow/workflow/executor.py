"""DAG workflow execution: topological order, link wiring, type-keyed handlers."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from .graph import WorkflowGraph, WorkflowLink, WorkflowNode
from .graph_algo import topological_order

NodeHandler = Callable[[WorkflowNode, Mapping[str, Any]], Mapping[str, Any]]


def _primary_output_socket_name(cls: type) -> str:
    specs = getattr(cls, "OUTPUT_SOCKETS", None) or []
    if specs and len(specs) > 0:
        first = specs[0]
        name = getattr(first, "name", None)
        if isinstance(name, str) and name.strip():
            return name.strip()
    return "out"


def handler_from_node_class(cls: type) -> NodeHandler:
    """Create a :data:`NodeHandler` from a ``@workflow_node``-decorated class.

    Each invocation instantiates the class and calls its *ENTRY* method
    (defaults to ``"execute"``). When *ENTRY* is ``"evaluate"``, the handler
    forwards to :meth:`evaluate` with ``clean_factor`` from *inputs* and kwargs
    from optional ``workflow_metric_kwargs``. If ``workflow_publish_evaluate_result``
    exists, its returned dict will be merged into handler outputs (see
    ``@workflow_node`` docs).
    """
    entry_name: str = getattr(cls, "ENTRY", "execute")

    if entry_name == "evaluate":

        def _handler_evaluate(
            node: WorkflowNode,
            inputs: Mapping[str, Any],
        ) -> Mapping[str, Any]:
            inst = cls()
            fdc = inputs["clean_factor"]
            validator = getattr(cls, "workflow_validate_clean_factor", None)
            if callable(validator):
                validator(fdc)
            kw_factory = getattr(cls, "workflow_metric_kwargs", None)
            if callable(kw_factory):
                kwargs = dict(kw_factory(node, inputs))
            else:
                kwargs = dict(node.params or {})
            raw = inst.evaluate(fdc, **kwargs)  # type: ignore[call-arg]
            primary = _primary_output_socket_name(cls)
            publisher = getattr(cls, "workflow_publish_evaluate_result", None)
            if callable(publisher):
                published = publisher(node, inputs, raw, primary)
                if published is None:
                    return {primary: raw}
                out = dict(published)
                # Ensure the primary socket always exists.
                out.setdefault(primary, raw)
                return out
            return {primary: raw}

        return _handler_evaluate

    def _handler(
        node: WorkflowNode,
        inputs: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        return getattr(cls(), entry_name)(node, inputs)  # type: ignore[no-any-return]

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
        input_sockets: Mapping[str, Any] | None = None,
    ) -> dict[str, dict[str, Any]]:
        """Run the workflow; return ``node_id -> {output_socket: value}``."""
        if not workflow.nodes:
            return {}
        # initial sockets act like root-provided inputs.
        # If a node outputs a value for one of these socket names, we update
        # the initial value so later nodes can see the updated value.
        initial: dict[str, Any] = dict(input_sockets or {})
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
            # Root injection: merge provided initial sockets into node inputs.
            # Linked socket wiring has higher priority.
            node_inputs = {**initial, **inputs}
            node_out = handler(node, node_inputs)
            node_out_dict = dict(node_out)
            # Keep root-provided socket values in sync with produced outputs.
            for k, v in node_out_dict.items():
                if k in initial:
                    initial[k] = v
            out[nid] = node_out_dict
        return out
