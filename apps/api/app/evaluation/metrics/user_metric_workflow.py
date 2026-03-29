"""Registry-backed user metrics: hooks for workflow entry="evaluate"."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from evaluate.alphalens_panel_utils import jsonable_metric_value, series_to_period_dict

from app.evaluation.scheme.metric_param_coerce import metric_evaluate_kwargs_from_registry


class RegistryUserEvaluationMetric(EvaluationMetric[Any]):
    """Subclass for workspace metrics: implement evaluate only.

    Set REGISTRY_METRIC_ID on the concrete class. Do not implement execute.
    """

    @classmethod
    def workflow_validate_clean_factor(cls, value: Any) -> None:
        if not isinstance(value, pd.DataFrame):
            raise TypeError("clean_factor 须为 DataFrame")

    @classmethod
    def workflow_metric_kwargs(cls, node: Any, inputs: Any) -> dict[str, Any]:
        mid = str(getattr(cls, "REGISTRY_METRIC_ID", "") or "").strip()
        if not mid:
            raise ValueError("REGISTRY_METRIC_ID 未设置")
        q = int(inputs["last_quantiles"])
        return metric_evaluate_kwargs_from_registry(
            mid,
            dict(node.params or {}),
            quantiles=q,
        )

    @classmethod
    def workflow_publish_evaluate_result(
        cls,
        node: Any,
        inputs: Any,
        raw: Any,
        primary_socket: str,
    ) -> dict[str, Any]:
        _ = inputs
        out_val = jsonable_metric_value(raw)
        if primary_socket == "mean_ic":
            series = raw
            if isinstance(series, pd.DataFrame):
                series = series.iloc[:, 0]
            merged_mean_ic = series_to_period_dict(series) if isinstance(series, pd.Series) else {}
            return {
                primary_socket: out_val,
                "merged_mean_ic": merged_mean_ic,
            }
        if primary_socket == "mean_return_spread" and isinstance(raw, pd.Series):
            return {
                primary_socket: out_val,
                "merged_spread": series_to_period_dict(raw),
            }
        return {primary_socket: out_val}
