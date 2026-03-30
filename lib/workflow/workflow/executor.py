"""DAG workflow execution: topological order, link wiring, type-keyed handlers."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import TYPE_CHECKING, Any

from .graph import WorkflowGraph, WorkflowLink
from .graph_algo import topological_order
from .node_types import Node

if TYPE_CHECKING:
    from .node_registry import RegisteredNode

NodeHandler = Callable[[Node, Mapping[str, Any]], Mapping[str, Any]]


def _output_socket_names_from_definition(definition: Node) -> list[str]:
    names: list[str] = []
    for s in definition.outputs:
        name = getattr(s, "name", None)
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


def _primary_output_socket_name(definition: Node) -> str:
    names = _output_socket_names_from_definition(definition)
    if names:
        return names[0]
    return "out"


def _normalize_execute_return_to_values(raw: Any, n: int) -> tuple[Any, ...]:
    """Align ``execute`` / ``evaluate`` return value(s) with *n* output sockets (declaration order).

    - ``n == 1``: one value per socket — a scalar, or a length-1 ``tuple`` / ``list`` (unwrapped).
    - ``n >= 2``: exactly ``n`` values as a ``tuple`` or ``list``, same order as output sockets.
    """
    if n <= 0:
        raise ValueError("internal: expected positive output socket count")

    if n == 1:
        if isinstance(raw, (tuple, list)):
            if len(raw) == 1:
                return (raw[0],)
            raise ValueError(
                f"expected 1 return value for 1 output socket, got {type(raw).__name__} of length {len(raw)}"
            )
        return (raw,)

    if not isinstance(raw, (tuple, list)):
        raise ValueError(
            f"expected a tuple or list of {n} values for {n} output sockets, got {type(raw).__name__!r}"
        )
    if len(raw) != n:
        raise ValueError(f"return has {len(raw)} value(s) but node has {n} output socket(s)")
    return tuple(raw)


def _coerce_node_return_to_outputs(output_names: list[str], raw: Any) -> dict[str, Any]:
    """Map entrypoint return value(s) to ``{output_socket_name: value}`` in socket order.

    With **zero** declared output sockets, the handler still runs the entrypoint; the
    return value is ignored for wiring and this returns ``{}`` (side-effect-only nodes).
    """
    n = len(output_names)
    if n == 0:
        return {}

    values = _normalize_execute_return_to_values(raw, n)
    return {output_names[i]: values[i] for i in range(n)}


def _merge_evaluate_publisher(
    base: dict[str, Any],
    raw: Any,
    primary: str,
    published: Any,
    *,
    inject_primary_fallback: bool = True,
) -> dict[str, Any]:
    if published is None:
        return base
    out = dict(published)
    for k, v in base.items():
        out.setdefault(k, v)
    if inject_primary_fallback and primary not in out:
        out[primary] = base.get(primary, raw)
    return out


def handler_from_node_class(cls: type, definition: Node) -> NodeHandler:
    """Create a :data:`NodeHandler` from a ``@workflow_node``-decorated class.

    *definition* must be the type template :class:`Node` for *cls* (same metadata as
    :func:`~workflow.node_registry.workflow_node_definition_from_class`).

    Each invocation instantiates the class and calls its entry method
    (defaults to ``"execute"``, invoked as ``execute(**merged)`` where *merged*
    combines node params, root ``input_sockets``, and linked outputs). When entry
    is ``"evaluate"``, the handler
    forwards to :meth:`evaluate` with ``clean_factor`` from *inputs* and kwargs
    from optional ``workflow_metric_kwargs``. If ``workflow_publish_evaluate_result``
    exists, its returned dict will be merged into handler outputs (see
    ``@workflow_node`` docs).

    Return normalization: values align 1:1 with declared output sockets in order - a
    scalar or length-1 ``tuple``/``list`` when there is one socket, otherwise a
    ``tuple`` or ``list`` of length *n*. **Zero** output sockets: entrypoint runs
    but returns ``{}`` (return value ignored). If ``evaluate`` returns a value that cannot be coerced to multiple
    outputs but ``workflow_publish_evaluate_result`` is defined, the handler
    falls back to ``{primary_socket: raw}`` before merging with the publisher.
    """
    entry_name: str = str(definition.entry or "execute") or "execute"

    if entry_name == "evaluate":

        def _handler_evaluate(
            node: Node,
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
            out_names = _output_socket_names_from_definition(definition)
            n_out = len(out_names)
            primary = _primary_output_socket_name(definition)
            publisher = getattr(cls, "workflow_publish_evaluate_result", None)
            try:
                base = _coerce_node_return_to_outputs(out_names, raw)
            except ValueError:
                if not callable(publisher):
                    raise
                base = {primary: raw}
            if callable(publisher):
                pub_result = publisher(node, inputs, raw, primary)
                return _merge_evaluate_publisher(
                    base,
                    raw,
                    primary,
                    pub_result,
                    inject_primary_fallback=n_out > 0,
                )
            return base

        return _handler_evaluate

    def _handler(
        node: Node,
        inputs: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        raw = getattr(cls(), entry_name)(**dict(inputs))
        out_names = _output_socket_names_from_definition(definition)
        return _coerce_node_return_to_outputs(out_names, raw)

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

    @classmethod
    def from_registry(cls, registry: Mapping[str, RegisteredNode]) -> WorkflowExecutor:
        """Build executor from ``type_id -> RegisteredNode`` (uses each ``.handler``)."""
        return cls({k: v.handler for k, v in registry.items()})

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
