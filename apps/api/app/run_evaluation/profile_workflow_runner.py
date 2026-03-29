"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import traceback
from collections.abc import Mapping
from typing import Any

import pandas as pd
from workflow import NodeHandler, WorkflowExecutor, WorkflowNode

from app.evaluation.metrics.builtin_metric_registry import (
    metric_node_type,
    parse_metric_node_type,
)
from app.evaluation.metrics.evaluation_metric_resolve import resolve_evaluation_metric
from app.evaluation.metrics.metric_schemas import (
    RESERVED_METRIC_WORKFLOW_PARAM_KEYS,
    MetricWorkflowParamSpec,
)
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry
from app.evaluation.scheme.node_type_registry import BUILTIN_HANDLERS
from app.evaluation.scheme.nodes._viz_base import _jsonable_metric_value
from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord
from app.evaluation.scheme.workflow_prepare import merge_profile_prepare_into_workflow
from app.factors.schemas import utc_now_iso

from .runner import (
    _series_to_period_dict,
    build_alphalens_evaluator_for_factor,
)
from .schemas import FactorEvaluationRecord


def _coerce_metric_param_number(spec: MetricWorkflowParamSpec, val: Any) -> Any:
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


def _coerce_metric_param_boolean(spec: MetricWorkflowParamSpec, val: Any) -> Any:
    if val is None or val == "":
        return None if spec.default is None else bool(spec.default)
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in {"1", "true", "yes", "on"}
    return bool(val)


def _coerce_metric_param_enum(spec: MetricWorkflowParamSpec, val: Any) -> Any:
    choices = list(spec.enum_values)
    if not choices:
        return None
    s = str(val).strip() if val is not None and val != "" else ""
    if not s and spec.default is not None:
        s = str(spec.default).strip()
    if s in choices:
        return s
    return choices[0]


def _coerce_metric_param_string(spec: MetricWorkflowParamSpec, val: Any) -> str | None:
    if val is None or val == "":
        if spec.default is None:
            return None
        return str(spec.default)
    s = str(val).strip()
    if not s:
        return None if spec.default is None else str(spec.default)
    return s


def _coerce_metric_param_value(spec: MetricWorkflowParamSpec, val: Any) -> Any:
    if spec.type == "number":
        return _coerce_metric_param_number(spec, val)
    if spec.type == "boolean":
        return _coerce_metric_param_boolean(spec, val)
    if spec.type == "enum":
        return _coerce_metric_param_enum(spec, val)
    if spec.type == "string":
        return _coerce_metric_param_string(spec, val)
    return None


def _metric_evaluate_kwargs(
    metric_id: str,
    raw_params: dict[str, Any],
    *,
    quantiles: int,
) -> dict[str, Any]:
    mrec = EvaluationMetricsRegistry.get_item(metric_id)
    specs = list(mrec.workflow_parameters) if mrec is not None else []
    raw = dict(raw_params or {})
    out: dict[str, Any] = {"quantiles": quantiles}
    if not specs:
        for k, v in raw.items():
            if k in RESERVED_METRIC_WORKFLOW_PARAM_KEYS:
                continue
            out[k] = v
        return out
    for spec in specs:
        key = spec.key
        if key in RESERVED_METRIC_WORKFLOW_PARAM_KEYS:
            continue
        val = raw.get(key, spec.default)
        coerced = _coerce_metric_param_value(spec, val)
        if coerced is None:
            continue
        out[key] = coerced
    return out


def _handle_metric(
    node: WorkflowNode,
    inputs: Mapping[str, Any],
    ctx: Any,
) -> dict[str, Any]:
    mid = parse_metric_node_type(node.type)
    if not mid:
        raise ValueError(f"非指标节点: {node.type!r}")
    resolved = resolve_evaluation_metric(mid)
    fdc = inputs["clean_factor"]
    if not isinstance(fdc, pd.DataFrame):
        raise TypeError("clean_factor 须为 DataFrame")
    inst = resolved.metric_class()
    last_quantiles: int = ctx["last_quantiles"]
    kwargs = _metric_evaluate_kwargs(mid, dict(node.params or {}), quantiles=last_quantiles)
    raw = inst.evaluate(fdc, **kwargs)  # type: ignore[call-arg]
    sock = resolved.primary_output_socket
    out_val = _jsonable_metric_value(raw)
    ctx["metric_results"][node.id] = {sock: out_val}
    if resolved.record_field == "mean_ic":
        series = raw
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        if isinstance(series, pd.Series):
            ctx["merged_mean_ic"] = _series_to_period_dict(series)
    elif resolved.record_field == "mean_return_spread":
        if isinstance(raw, pd.Series):
            ctx["merged_spread"] = _series_to_period_dict(raw)
    return {sock: raw}


def _evaluation_profile_handlers() -> dict[str, NodeHandler]:
    h: dict[str, NodeHandler] = dict(BUILTIN_HANDLERS)
    for item in EvaluationMetricsRegistry.list_items():
        h[metric_node_type(item.id)] = _handle_metric
    return h


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
    *,
    data_set_id: str | None,
) -> FactorEvaluationRecord:
    profile = profile.model_copy(
        update={
            "workflow": merge_profile_prepare_into_workflow(
                profile.workflow,
                profile_prepare=profile.prepare,
            ),
        }
    )
    wf = profile.workflow
    err, ev, window, base_quantiles, _ = build_alphalens_evaluator_for_factor(
        factor_id, data_set_id=data_set_id
    )
    if err is not None:
        return err.model_copy(update={"evaluation_profile_id": profile.id})

    assert ev is not None
    metric_results: dict[str, Any] = {}
    ctx: dict[str, Any] = {
        "ev": ev,
        "last_quantiles": base_quantiles,
        "n_stocks": None,
        "metric_results": metric_results,
        "merged_mean_ic": {},
        "merged_spread": {},
    }

    try:
        _ = WorkflowExecutor(_evaluation_profile_handlers()).execute(
            wf,
            context=ctx,
        )
    except ValueError as e:
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            window=window,
            mean_ic={},
            mean_return_spread={},
            error=str(e),
            evaluation_profile_id=profile.id,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            window=window,
            mean_ic={},
            mean_return_spread={},
            error=f"{e}\n{tb}",
            evaluation_profile_id=profile.id,
            metric_results=metric_results,
        )

    return FactorEvaluationRecord(
        evaluated_at=utc_now_iso(),
        window=window,
        stock_count=ctx["n_stocks"],
        mean_ic=ctx["merged_mean_ic"],
        mean_return_spread=ctx["merged_spread"],
        error=None,
        evaluation_profile_id=profile.id,
        metric_results=metric_results,
    )
