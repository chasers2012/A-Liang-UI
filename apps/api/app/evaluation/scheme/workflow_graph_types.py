"""Dynamic workflow node types: prepare + metric:<id> for builtins and registry items."""

from __future__ import annotations

from workflow import NodeSpec, SocketSpec

from app.evaluation.metrics.builtin_metric_registry import (
    metric_node_type,
    parse_metric_node_type,
)
from app.evaluation.metrics.evaluation_metric_resolve import try_resolve_evaluation_metric
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry

from .node_type_registry import BUILTIN_NODE_SPECS

_DEFAULT_METRIC_INPUTS = (SocketSpec("clean_factor", True, "factor_data_clean"),)
_DEFAULT_METRIC_OUTPUTS = (SocketSpec("out", False, "scalar_json"),)


def all_workflow_node_type_ids() -> frozenset[str]:
    out: set[str] = set(BUILTIN_NODE_SPECS.keys())
    for item in EvaluationMetricsRegistry.list_items():
        out.add(metric_node_type(item.id))
    return frozenset(out)


def workflow_node_definition(node_type: str) -> NodeSpec:
    nt = (node_type or "").strip()
    if nt in BUILTIN_NODE_SPECS:
        return BUILTIN_NODE_SPECS[nt]
    mid = parse_metric_node_type(nt)
    if mid is None:
        raise KeyError(nt)
    resolved = try_resolve_evaluation_metric(mid)
    if resolved is None:
        raise KeyError(nt)
    rec = EvaluationMetricsRegistry.get_item(mid)
    if rec is None:
        raise KeyError(nt)
    cls = resolved.metric_class
    node_spec_fn = getattr(cls, "__node_spec__", None)
    if callable(node_spec_fn):
        return node_spec_fn(
            type_id=nt,
            label=rec.name,
            description=rec.description,
            default_inputs=_DEFAULT_METRIC_INPUTS,
            default_outputs=_DEFAULT_METRIC_OUTPUTS,
        )
    return NodeSpec(
        type=nt,
        label=rec.name,
        description=rec.description,
        inputs=_DEFAULT_METRIC_INPUTS,
        outputs=_DEFAULT_METRIC_OUTPUTS,
    )


def workflow_node_definition_or_fail(node_type: str) -> NodeSpec:
    try:
        return workflow_node_definition(node_type)
    except KeyError as e:
        raise ValueError(f"未知节点类型: {node_type!r}") from e
