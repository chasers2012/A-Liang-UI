"""Execute a user-defined metric from the workspace registry inside a workflow node."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pandas as pd
from evaluate import EvaluationMetric, load_evaluation_metric_class
from evaluate.alphalens_panel_utils import jsonable_metric_value, series_to_period_dict
from workflow import WorkflowNode

from .metric_param_coerce import metric_evaluate_kwargs_from_registry
from .metrics_store import EvaluationMetricsRegistry


def _primary_output_from_class(cls: type[EvaluationMetric]) -> str:
    raw = getattr(cls, "OUTPUT_SOCKETS", None) or []
    if raw and isinstance(raw, (list, tuple)) and len(raw) > 0:
        first = raw[0]
        if isinstance(first, dict) and first.get("name"):
            return str(first["name"])
    return "out"


def run_registry_evaluation_metric(
    registry_metric_id: str,
    node: WorkflowNode,
    inputs: Mapping[str, Any],
    ctx: Any,
) -> dict[str, Any]:
    rec = EvaluationMetricsRegistry.get_item(registry_metric_id)
    if rec is None:
        raise ValueError(f"评价指标不存在: {registry_metric_id}")
    src = EvaluationMetricsRegistry.read_source(rec)
    cls, _ = load_evaluation_metric_class(src)
    fdc = inputs["clean_factor"]
    if not isinstance(fdc, pd.DataFrame):
        raise TypeError("clean_factor 须为 DataFrame")
    inst = cls()
    last_quantiles: int = ctx["last_quantiles"]
    kwargs = metric_evaluate_kwargs_from_registry(
        registry_metric_id,
        dict(node.params or {}),
        quantiles=last_quantiles,
    )
    raw = inst.evaluate(fdc, **kwargs)  # type: ignore[call-arg]
    sock = _primary_output_from_class(cls)
    out_val = jsonable_metric_value(raw)
    ctx["metric_results"][node.id] = {sock: out_val}
    if sock == "mean_ic":
        series = raw
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        if isinstance(series, pd.Series):
            ctx["merged_mean_ic"] = series_to_period_dict(series)
    elif sock == "mean_return_spread" and isinstance(raw, pd.Series):
        ctx["merged_spread"] = series_to_period_dict(raw)
    return {sock: raw}
