"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import traceback
from collections import defaultdict, deque
from typing import Any

import pandas as pd
from evaluate import MeanInformationCoefficientMetric
from evaluate.factor_evaluator import _alphalens_metrics

from app.evaluation.metric_loader import load_evaluation_metric_class
from app.evaluation.metrics_store import get_by_id as metric_get_by_id
from app.evaluation.metrics_store import load_registry as load_metrics_registry
from app.evaluation.metrics_store import read_source as read_metric_source
from app.evaluation.profile_schemas import EvaluationProfileRecord
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


def run_evaluation_profile_workflow(  # noqa: C901
    factor_id: str,
    profile: EvaluationProfileRecord,
    *,
    test_set_id: str | None,
) -> FactorEvaluationSnapshot:
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
            params = dict(node.params or {})

            if nt == "prepare_alphalens":
                periods = tuple(
                    int(x)
                    for x in (params.get("forward_return_periods") or prep.forward_return_periods)
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

            elif nt == "mean_information_coefficient":
                fdc = _resolve_socket(wf, outputs, nid, "clean_factor")
                if not isinstance(fdc, pd.DataFrame):
                    raise TypeError("clean_factor 须为 DataFrame")
                series = MeanInformationCoefficientMetric().evaluate(fdc)
                if isinstance(series, pd.DataFrame):
                    series = series.iloc[:, 0]
                mic = _series_to_period_dict(series)
                outputs[nid] = {"mean_ic": series}
                metric_results[nid] = {"mean_ic": mic}
                merged_mean_ic = mic

            elif nt == "mean_return_spread":
                fdc = _resolve_socket(wf, outputs, nid, "clean_factor")
                if not isinstance(fdc, pd.DataFrame):
                    raise TypeError("clean_factor 须为 DataFrame")
                metrics = _alphalens_metrics(
                    fdc,
                    quantiles=last_quantiles,
                    group_adjust=False,
                    quantile_returns_demeaned=True,
                )
                spread = _series_to_period_dict(metrics.mean_return_spread)
                outputs[nid] = {"mean_return_spread": metrics.mean_return_spread}
                metric_results[nid] = {"mean_return_spread": spread}
                merged_spread = spread

            elif nt == "user_metric":
                fdc = _resolve_socket(wf, outputs, nid, "clean_factor")
                if not isinstance(fdc, pd.DataFrame):
                    raise TypeError("clean_factor 须为 DataFrame")
                mid = str(params.get("metric_id") or "").strip()
                if not mid:
                    raise ValueError("user_metric 节点须设置 params.metric_id")
                mreg = load_metrics_registry()
                mrec = metric_get_by_id(mreg, mid)
                if mrec is None:
                    raise ValueError(f"评价指标不存在: {mid}")
                src = read_metric_source(mrec)
                cls, _ = load_evaluation_metric_class(src)
                inst = cls()
                raw = inst.evaluate(fdc)  # type: ignore[call-arg]
                out_val = _jsonable_metric_value(raw)
                outputs[nid] = {"out": raw}
                metric_results[nid] = {"out": out_val}

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
