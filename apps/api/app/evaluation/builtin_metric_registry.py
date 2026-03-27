"""Built-in evaluation metrics: stable ids, classes, and workflow wiring."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from evaluate import EvaluationMetric, MeanInformationCoefficientMetric
from evaluate.factor_evaluator import MeanReturnSpreadMetric

METRIC_NODE_TYPE_PREFIX = "metric:"

SnapshotField = Literal["mean_ic", "mean_return_spread"]


@dataclass(frozen=True)
class BuiltinMetricEntry:
    metric_id: str
    label: str
    description: str
    metric_class: type[EvaluationMetric]
    primary_output_socket: str
    snapshot_field: SnapshotField | None


BUILTIN_METRICS: dict[str, BuiltinMetricEntry] = {
    "builtin.mean_ic": BuiltinMetricEntry(
        metric_id="builtin.mean_ic",
        label="平均 IC",
        description="各持有期平均信息系数（Alphalens）",
        metric_class=MeanInformationCoefficientMetric,
        primary_output_socket="mean_ic",
        snapshot_field="mean_ic",
    ),
    "builtin.mean_return_spread": BuiltinMetricEntry(
        metric_id="builtin.mean_return_spread",
        label="多空收益差",
        description="分位多空平均收益差（按持有期）",
        metric_class=MeanReturnSpreadMetric,
        primary_output_socket="mean_return_spread",
        snapshot_field="mean_return_spread",
    ),
}


def metric_node_type(metric_id: str) -> str:
    if ":" in metric_id:
        raise ValueError("metric_id 不得包含冒号")
    return f"{METRIC_NODE_TYPE_PREFIX}{metric_id}"


def parse_metric_node_type(node_type: str) -> str | None:
    if not node_type.startswith(METRIC_NODE_TYPE_PREFIX):
        return None
    mid = node_type[len(METRIC_NODE_TYPE_PREFIX) :].strip()
    return mid or None


def is_builtin_metric_id(metric_id: str) -> bool:
    return metric_id in BUILTIN_METRICS


def get_builtin_entry(metric_id: str) -> BuiltinMetricEntry | None:
    return BUILTIN_METRICS.get(metric_id)
