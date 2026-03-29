"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import contextlib
import re
import traceback
from typing import Any

import pandas as pd
from workflow import topological_order

from app.evaluation.metrics.builtin_metric_registry import parse_metric_node_type
from app.evaluation.metrics.evaluation_metric_resolve import resolve_evaluation_metric
from app.evaluation.metrics.metric_schemas import (
    RESERVED_METRIC_WORKFLOW_PARAM_KEYS,
    MetricWorkflowParamSpec,
)
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry
from app.evaluation.scheme.node_type_registry import is_viz_node_type
from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord
from app.evaluation.scheme.workflow_prepare import merge_profile_prepare_into_workflow
from app.factors.schemas import utc_now_iso

from .runner import (
    _series_to_period_dict,
    _stock_count_from_alignment,
    build_alphalens_evaluator_for_factor,
)
from .schemas import FactorEvaluationRecord


def _resolve_socket(
    workflow,
    outputs: dict[str, dict[str, Any]],
    to_node: str,
    to_socket: str,
) -> Any:
    for link in workflow.links:
        if link.to_node == to_node and link.to_socket == to_socket:
            bucket = outputs.get(link.from_node)
            if bucket is None:
                raise KeyError(link.from_node)
            if link.from_socket not in bucket:
                raise KeyError(link.from_socket)
            return bucket[link.from_socket]
    raise KeyError(f"未连接输入 {to_node!r}.{to_socket!r}")


def _jsonable_metric_value(val: Any) -> Any:
    if isinstance(val, pd.Series):
        return _series_to_period_dict(val)
    if isinstance(val, dict):
        return {str(k): float(v) for k, v in val.items() if not pd.isna(v)}
    return val


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


def _forward_periods_tuple(raw: Any) -> tuple[int, ...]:
    if isinstance(raw, list):
        out = tuple(int(float(x)) for x in raw)
        return out if out else (1, 5, 10, 20)
    s = str(raw).strip() if raw is not None and raw != "" else "1,5,10,20"
    parts = [p.strip() for p in re.split(r"[,，\s]+", s) if p.strip()]
    if not parts:
        return (1, 5, 10, 20)
    return tuple(int(float(x)) for x in parts)


def _node_prepare_alphalens(
    nid: str,
    node,
    ev,
    *,
    last_quantiles: int,
    outputs: dict[str, dict[str, Any]],
    metric_results: dict[str, Any],
) -> tuple[int, int | None]:
    params = dict(node.params or {})
    periods = _forward_periods_tuple(params.get("forward_return_periods"))
    q_raw = params.get("alphalens_quantiles", params.get("quantiles"))
    if isinstance(q_raw, (int, float)) and not isinstance(q_raw, bool):
        last_quantiles = max(2, int(q_raw))
    elif q_raw is not None and str(q_raw).strip() != "":
        with contextlib.suppress(TypeError, ValueError):
            last_quantiles = max(2, int(float(str(q_raw).strip())))
    ls = bool(params.get("long_short", True))
    try:
        ml = float(params.get("max_loss", 0.5))
    except (TypeError, ValueError):
        ml = 0.5
    ev.long_short = ls
    out = ev.evaluate_factor(
        quantiles=last_quantiles,
        periods=periods,
        max_loss=ml,
    )
    n_stocks = _stock_count_from_alignment(ev.alignment_index())
    outputs[nid] = {"clean_factor": out.factor_data_clean}
    metric_results[nid] = {"clean_factor": "[DataFrame]"}
    return last_quantiles, n_stocks


def _run_metric_node(
    wf,
    nid: str,
    node,
    *,
    last_quantiles: int,
    outputs: dict[str, dict[str, Any]],
    metric_results: dict[str, Any],
) -> tuple[dict[str, float] | None, dict[str, float] | None]:
    mid = parse_metric_node_type(node.type)
    if not mid:
        raise ValueError(f"非指标节点: {node.type!r}")
    resolved = resolve_evaluation_metric(mid)
    fdc = _resolve_socket(wf, outputs, nid, "clean_factor")
    if not isinstance(fdc, pd.DataFrame):
        raise TypeError("clean_factor 须为 DataFrame")
    inst = resolved.metric_class()
    kwargs = _metric_evaluate_kwargs(mid, dict(node.params or {}), quantiles=last_quantiles)
    raw = inst.evaluate(fdc, **kwargs)  # type: ignore[call-arg]
    sock = resolved.primary_output_socket
    out_val = _jsonable_metric_value(raw)
    outputs[nid] = {sock: raw}
    metric_results[nid] = {sock: out_val}
    mic_merge: dict[str, float] | None = None
    spread_merge: dict[str, float] | None = None
    if resolved.record_field == "mean_ic":
        series = raw
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        if isinstance(series, pd.Series):
            mic_merge = _series_to_period_dict(series)
    elif resolved.record_field == "mean_return_spread":
        if isinstance(raw, pd.Series):
            spread_merge = _series_to_period_dict(raw)
    return mic_merge, spread_merge


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
    by_id = {n.id: n for n in wf.nodes}
    try:
        order = topological_order(wf.nodes, wf.links)
    except ValueError as e:
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            window=window,
            mean_ic={},
            mean_return_spread={},
            error=str(e),
            evaluation_profile_id=profile.id,
        )

    outputs: dict[str, dict[str, Any]] = {}
    metric_results: dict[str, Any] = {}
    last_quantiles = base_quantiles
    n_stocks: int | None = None
    merged_mean_ic: dict[str, float] = {}
    merged_spread: dict[str, float] = {}

    try:
        for nid in order:
            node = by_id[nid]
            nt = node.type

            if nt == "prepare_alphalens":
                last_quantiles, n_stocks = _node_prepare_alphalens(
                    nid,
                    node,
                    ev,
                    last_quantiles=last_quantiles,
                    outputs=outputs,
                    metric_results=metric_results,
                )
            elif is_viz_node_type(nt):
                val = _resolve_socket(wf, outputs, nid, "in")
                outputs[nid] = {"out": val}
                metric_results[nid] = {"out": _jsonable_metric_value(val)}
            elif parse_metric_node_type(nt):
                mic, sp = _run_metric_node(
                    wf,
                    nid,
                    node,
                    last_quantiles=last_quantiles,
                    outputs=outputs,
                    metric_results=metric_results,
                )
                if mic is not None:
                    merged_mean_ic = mic
                if sp is not None:
                    merged_spread = sp
            else:
                raise ValueError(f"未知节点类型: {nt}")

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
        stock_count=n_stocks,
        mean_ic=merged_mean_ic,
        mean_return_spread=merged_spread,
        error=None,
        evaluation_profile_id=profile.id,
        metric_results=metric_results,
    )
