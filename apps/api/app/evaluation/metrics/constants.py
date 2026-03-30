USER_METRIC_WORKFLOW_ROOT = "workflow_nodes/evaluation"

DEFAULT_METRIC_SOURCE = """
from __future__ import annotations
from typing import Any
import pandas as pd
from evaluate import EvaluationMetric
from workflow import workflow_node, workflow_socket



@workflow_node(
    label="新指标",
    description="",
    entry="evaluate",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
        workflow_socket("last_quantiles", required=True, value_type="scalar_json"),
    ],
    output_sockets=[
        workflow_socket("out", value_type="scalar_json"),
        workflow_socket("merged_mean_ic", required=False, value_type="scalar_json"),
        workflow_socket("merged_spread", required=False, value_type="scalar_json"),
    ],
)
class NewEvaluationMetric(EvaluationMetric):

    def evaluate(self, clean_factor: pd.DataFrame, **kwargs: Any) -> tuple[Any, dict[str, Any], dict[str, Any]]:
        _ = clean_factor
        return 0.0
"""
