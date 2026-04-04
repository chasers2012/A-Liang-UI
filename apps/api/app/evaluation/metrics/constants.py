USER_METRIC_WORKFLOW_ROOT = "workflow_nodes/evaluation"
REGISTRY_FILENAME = "evaluation/metrics/registry.json"

INTERNAL_EVALUATION_METRIC_PACKAGES = ["evaluation_workflow_nodes"]

DEFAULT_METRIC_SOURCE = """
from __future__ import annotations
from typing import Any
import pandas as pd
from evaluate import EvaluationMetric
from workflow import workflow_node, Socket



@workflow_node(
    label="新指标",
    description="",
    entry="evaluate",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
        Socket("last_quantiles", required=True, value_type="scalar_json"),
    ],
    output_sockets=[
        Socket("out", value_type="scalar_json"),
        Socket("merged_mean_ic", required=False, value_type="scalar_json"),
        Socket("merged_spread", required=False, value_type="scalar_json"),
    ],
)
class NewEvaluationMetric(EvaluationMetric):

    def evaluate(self, clean_factor: pd.DataFrame, **kwargs: Any) -> tuple[Any, dict[str, Any], dict[str, Any]]:
        _ = clean_factor
        return 0.0
"""
