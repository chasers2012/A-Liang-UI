"""Coerce evaluation metric node params using :class:`workflow.NodeParamModel` lists."""

from __future__ import annotations

from typing import Any

from workflow import NodeParamModel

from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry

from .metric_workflow_parameters import RESERVED_METRIC_WORKFLOW_PARAM_KEYS


def coerce_metric_param_number(spec: NodeParamModel, val: Any) -> Any:
    if val is None or val == "":
        return None
    try:
        x = float(val)
    except (TypeError, ValueError):
        try:
            x = float(spec.default) if spec.default is not None else None
        except (TypeError, ValueError):
            return None
    if x is None:
        return None
    if spec.minimum is not None:
        x = max(x, float(spec.minimum))
    if spec.maximum is not None:
        x = min(x, float(spec.maximum))
    return int(x) if float(x).is_integer() else x


def coerce_metric_param_boolean(spec: NodeParamModel, val: Any) -> Any:
    if val is None or val == "":
        return None if spec.default is None else bool(spec.default)
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in {"1", "true", "yes", "on"}
    return bool(val)


def coerce_metric_param_enum(spec: NodeParamModel, val: Any) -> Any:
    choices = list(spec.enum_values)
    if not choices:
        return None
    s = str(val).strip() if val is not None and val != "" else ""
    if not s and spec.default is not None:
        s = str(spec.default).strip()
    if s in choices:
        return s
    return choices[0]


def coerce_metric_param_string(spec: NodeParamModel, val: Any) -> str | None:
    if val is None or val == "":
        if spec.default is None:
            return None
        return str(spec.default)
    s = str(val).strip()
    if not s:
        return None if spec.default is None else str(spec.default)
    return s


def coerce_metric_param_value(spec: NodeParamModel, val: Any) -> Any:
    if spec.type == "number":
        return coerce_metric_param_number(spec, val)
    if spec.type == "boolean":
        return coerce_metric_param_boolean(spec, val)
    if spec.type == "enum":
        return coerce_metric_param_enum(spec, val)
    if spec.type == "string":
        return coerce_metric_param_string(spec, val)
    return None


def metric_evaluate_kwargs_from_registry(
    metric_id: str,
    raw_params: dict[str, Any],
    *,
    quantiles: int,
) -> dict[str, Any]:
    """Build kwargs for evaluating one metric from registry schema + node params."""
    mrec = EvaluationMetricsRegistry.get_item(metric_id)
    specs = list(mrec.workflow_parameters) if mrec is not None else []
    raw = dict(raw_params or {})
    out: dict[str, Any] = {"quantiles": quantiles}
    if not specs:
        out.update({k: v for k, v in raw.items() if k not in RESERVED_METRIC_WORKFLOW_PARAM_KEYS})
        return out
    for spec in specs:
        key = spec.key
        if key in RESERVED_METRIC_WORKFLOW_PARAM_KEYS:
            continue
        val = raw.get(key, spec.default)
        coerced = coerce_metric_param_value(spec, val)
        if coerced is None:
            continue
        out[key] = coerced
    return out
