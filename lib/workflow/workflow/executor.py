"""DAG workflow execution: topological order, link wiring, type-keyed handlers."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from .graph import WorkflowGraph, WorkflowLink, WorkflowNode
from .graph_algo import topological_order

NodeHandler = Callable[[WorkflowNode, Mapping[str, Any]], Mapping[str, Any]]


def _primary_output_socket_name(cls: type) -> str:
    names = _output_socket_names(cls)
    if names:
        return names[0]
    return "out"


def _output_socket_names(cls: type) -> list[str]:
    specs = getattr(cls, "OUTPUT_SOCKETS", None) or []
    names: list[str] = []
    for s in specs:
        name = getattr(s, "name", None)
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


def _coerce_node_return_to_outputs(cls: type, raw: Any) -> dict[str, Any]:
    """Map a node return value to ``{output_socket_name: value}``.

    - ``dict``: keys are socket names (plain ``dict`` only; not arbitrary ``Mapping``).
    - ``tuple``: one element per :attr:`OUTPUT_SOCKETS` (non-empty names), same order.
    - Any other value: only if there is exactly one output socket; otherwise raises.
    """
    names = _output_socket_names(cls)
    n = len(names)

    if isinstance(raw, dict):
        return dict(raw)

    if isinstance(raw, tuple):
        if n == 0:
            return {"out": raw}
        if len(raw) != n:
            raise ValueError(
                f"tuple return length {len(raw)} does not match output socket count {n}"
            )
        return {names[i]: raw[i] for i in range(n)}

    if n == 0:
        return {"out": raw}
    if n == 1:
        return {names[0]: raw}
    raise ValueError(
        f"node has {n} output sockets but returned a value that is neither dict nor tuple"
    )


def _merge_evaluate_publisher(
    base: dict[str, Any],
    raw: Any,
    primary: str,
    published: Any,
) -> dict[str, Any]:
    if published is None:
        return base
    out = dict(published)
    for k, v in base.items():
        out.setdefault(k, v)
    if primary not in out:
        out[primary] = base.get(primary, raw)
    return out


def handler_from_node_class(cls: type) -> NodeHandler:
    """Create a :data:`NodeHandler` from a ``@workflow_node``-decorated class.

    Each invocation instantiates the class and calls its *ENTRY* method
    (defaults to ``"execute"``, invoked as ``execute(**merged)`` where *merged*
    combines node params, root ``input_sockets``, and linked outputs). When *ENTRY*
    is ``"evaluate"``, the handler
    forwards to :meth:`evaluate` with ``clean_factor`` from *inputs* and kwargs
    from optional ``workflow_metric_kwargs``. If ``workflow_publish_evaluate_result``
    exists, its returned dict will be merged into handler outputs (see
    ``@workflow_node`` docs).

    Return normalization: plain ``dict`` (socket names as keys), ``tuple`` aligned
    with ``OUTPUT_SOCKETS`` order, or a single value when there is one output
    socket. If ``evaluate`` returns a value that cannot be coerced to multiple
    outputs but ``workflow_publish_evaluate_result`` is defined, the handler
    falls back to ``{primary_socket: raw}`` before merging with the publisher.
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
            try:
                base = _coerce_node_return_to_outputs(cls, raw)
            except ValueError:
                if not callable(publisher):
                    raise
                base = {primary: raw}
            if callable(publisher):
                pub_result = publisher(node, inputs, raw, primary)
                return _merge_evaluate_publisher(base, raw, primary, pub_result)
            return base

        return _handler_evaluate

    def _handler(
        node: WorkflowNode,
        inputs: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        raw = getattr(cls(), entry_name)(**dict(inputs))
        return _coerce_node_return_to_outputs(cls, raw)

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
            # Node params, then root injection, then linked sockets (highest priority).
            node_inputs = {**(node.params or {}), **initial, **inputs}
            node_out = handler(node, node_inputs)
            node_out_dict = dict(node_out)
            # Keep root-provided socket values in sync with produced outputs.
            for k, v in node_out_dict.items():
                if k in initial:
                    initial[k] = v
            out[nid] = node_out_dict
        return out
