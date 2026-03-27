"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import traceback
from collections import defaultdict, deque
from typing import Any

import pandas as pd

from app.evaluation.builtin_metric_registry import parse_metric_node_type
from app.evaluation.evaluation_metric_resolve import resolve_evaluation_metric
from app.evaluation.metric_schemas import (
    RESERVED_METRIC_WORKFLOW_PARAM_KEYS,
    MetricWorkflowParamSpec,
)
from app.evaluation.metrics_store import get_by_id as metric_get_by_id
from app.evaluation.metrics_store import load_registry as load_metrics_registry
from app.evaluation.profile_schemas import EvaluationProfileRecord
from app.evaluation.workflow_migrate import migrate_evaluation_workflow
from app.factors.evaluation_runner import (
    _series_to_period_dict,
    _stock_count_from_alignment,
    build_alphalens_evaluator_for_factor,
)
from app.factors.evaluation_schemas import FactorEvaluationSnapshot
from app.factors.schemas import utc_now_iso


def _workflow_topological_order(workflow) -> list[str]:
    by_id = {n.id: n for n in workflow.nodes}
    adj: dict[str, list[str]] = defaultdict(list)
    indeg: dict[str, int] = dict.fromkeys(by_id, 0)
    for link in workflow.links:
        adj[link.from_node].append(link.to_node)
        indeg[link.to_node] += 1
    q = deque([nid for nid, d in indeg.items() if d == 0])
    out: list[str] = []
    while q:
        u = q.popleft()
        out.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(out) != len(by_id):
        raise ValueError("工作流存在环路")
    return out


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


def _coerce_metric_param_value(spec: MetricWorkflowParamSpec, val: Any) -> Any:
    if spec.type == "number":
        return _coerce_metric_param_number(spec, val)
    if spec.type == "boolean":
        return _coerce_metric_param_boolean(spec, val)
    if spec.type == "enum":
        return _coerce_metric_param_enum(spec, val)
    return None


def _metric_evaluate_kwargs(
    metric_id: str,
    raw_params: dict[str, Any],
    *,
    quantiles: int,
) -> dict[str, Any]:
    reg = load_metrics_registry()
    mrec = metric_get_by_id(reg, metric_id)
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


def _node_prepare_alphalens(
    nid: str,
    node,
    ev,
    prep,
    *,
    last_quantiles: int,
    outputs: dict[str, dict[str, Any]],
    metric_results: dict[str, Any],
) -> tuple[int, int | None]:
    params = dict(node.params or {})
    periods = tuple(
        int(x) for x in (params.get("forward_return_periods") or prep.forward_return_periods)
    )
    if params.get("quantiles") is not None:
        last_quantiles = max(2, int(params["quantiles"]))
    elif prep.quantiles is not None:
        last_quantiles = max(2, int(prep.quantiles))
    ls = bool(params.get("long_short", prep.long_short))
    ml = float(params.get("max_loss", prep.max_loss))
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
    if resolved.snapshot_field == "mean_ic":
        series = raw
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        if isinstance(series, pd.Series):
            mic_merge = _series_to_period_dict(series)
    elif resolved.snapshot_field == "mean_return_spread":
        if isinstance(raw, pd.Series):
            spread_merge = _series_to_period_dict(raw)
    return mic_merge, spread_merge


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
    *,
    test_set_id: str | None,
) -> FactorEvaluationSnapshot:
    profile = profile.model_copy(update={"workflow": migrate_evaluation_workflow(profile.workflow)})
    wf = profile.workflow
    err, ev, window, base_quantiles, _ = build_alphalens_evaluator_for_factor(
        factor_id, test_set_id=test_set_id
    )
    if err is not None:
        return err.model_copy(update={"evaluation_profile_id": profile.id})

    assert ev is not None
    prep = profile.prepare
    by_id = {n.id: n for n in wf.nodes}
    try:
        order = _workflow_topological_order(wf)
    except ValueError as e:
        return FactorEvaluationSnapshot(
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
                    prep,
                    last_quantiles=last_quantiles,
                    outputs=outputs,
                    metric_results=metric_results,
                )
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
        return FactorEvaluationSnapshot(
            evaluated_at=utc_now_iso(),
            window=window,
            mean_ic={},
            mean_return_spread={},
            error=f"{e}\n{tb}",
            evaluation_profile_id=profile.id,
            metric_results=metric_results,
        )

    return FactorEvaluationSnapshot(
        evaluated_at=utc_now_iso(),
        window=window,
        stock_count=n_stocks,
        mean_ic=merged_mean_ic,
        mean_return_spread=merged_spread,
        error=None,
        evaluation_profile_id=profile.id,
        metric_results=metric_results,
    )
