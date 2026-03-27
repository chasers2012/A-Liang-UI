"""Dynamic workflow node types: prepare + metric:<id> for builtins and registry items."""

from __future__ import annotations

from app.evaluation.builtin_metric_registry import metric_node_type, parse_metric_node_type
from app.evaluation.evaluation_metric_resolve import try_resolve_evaluation_metric
from app.evaluation.metrics_store import get_by_id as metric_get_by_id
from app.evaluation.metrics_store import load_registry as load_metrics_registry
from app.evaluation.node_type_registry import BUILTIN_NODE_SPECS, BuiltinNodeSpec, SocketSpec


def all_workflow_node_type_ids() -> frozenset[str]:
    out: set[str] = set(BUILTIN_NODE_SPECS.keys())
    reg = load_metrics_registry()
    for item in reg.items:
        out.add(metric_node_type(item.id))
    return frozenset(out)


def _default_metric_sockets() -> tuple[tuple[SocketSpec, ...], tuple[SocketSpec, ...]]:
    return (
        (SocketSpec("clean_factor", True, "factor_data_clean"),),
        (SocketSpec("out", False, "scalar_json"),),
    )


def _sockets_from_metric_class(cls: type) -> tuple[tuple[SocketSpec, ...], tuple[SocketSpec, ...]]:
    def conv(raw: list | tuple | None) -> tuple[SocketSpec, ...] | None:
        if not raw:
            return None
        out: list[SocketSpec] = []
        for x in raw:
            if not isinstance(x, dict):
                continue
            name = x.get("name")
            if not name:
                continue
            out.append(
                SocketSpec(
                    str(name),
                    bool(x.get("required", False)),
                    str(x.get("value_type", "any")),
                )
            )
        return tuple(out) if out else None

    raw_in = getattr(cls, "INPUT_SOCKETS", None)
    raw_out = getattr(cls, "OUTPUT_SOCKETS", None)
    ins = conv(raw_in)
    outs = conv(raw_out)
    din, dout = _default_metric_sockets()
    return (ins or din), (outs or dout)


def workflow_node_definition(node_type: str) -> BuiltinNodeSpec:
    nt = (node_type or "").strip()
    if nt in BUILTIN_NODE_SPECS:
        return BUILTIN_NODE_SPECS[nt]
    mid = parse_metric_node_type(nt)
    if mid is None:
        raise KeyError(nt)
    resolved = try_resolve_evaluation_metric(mid)
    if resolved is None:
        raise KeyError(nt)
    reg = load_metrics_registry()
    rec = metric_get_by_id(reg, mid)
    if rec is None:
        raise KeyError(nt)
    ins, outs = _sockets_from_metric_class(resolved.metric_class)
    return BuiltinNodeSpec(
        type=nt,
        label=rec.name,
        description=rec.description,
        inputs=ins,
        outputs=outs,
    )


def workflow_node_definition_or_fail(node_type: str) -> BuiltinNodeSpec:
    try:
        return workflow_node_definition(node_type)
    except KeyError as e:
        raise ValueError(f"未知节点类型: {node_type!r}") from e
