from __future__ import annotations

import json
import uuid

from app import datetime_utils

USER_METRIC_WORKFLOW_ROOT = "workflow_nodes/evaluation"
utc_now_iso = datetime_utils.utc_now_iso


def user_metric_package_dir(metric_id: str) -> str:
    return f"em_{metric_id.replace('-', '_')}"


def user_metric_workflow_type_id(metric_id: str) -> str:
    return f"{user_metric_package_dir(metric_id)}.metric_node.UserEvaluationMetric"


def user_metric_source_path(metric_id: str) -> str:
    return f"{USER_METRIC_WORKFLOW_ROOT}/{user_metric_package_dir(metric_id)}/metric_node.py"


def user_metric_init_path(metric_id: str) -> str:
    return f"{USER_METRIC_WORKFLOW_ROOT}/{user_metric_package_dir(metric_id)}/__init__.py"


def user_metric_package_parts(metric_id: str) -> tuple[str, str, str]:
    d = user_metric_package_dir(metric_id)
    return d, user_metric_init_path(metric_id), user_metric_source_path(metric_id)


def registry_metric_id_from_workflow_type(workflow_type_id: str) -> str | None:
    """Resolve registry metric id from ``em_<id>.metric_node.UserEvaluationMetric`` node type FQN."""
    w = (workflow_type_id or "").strip()
    if w.endswith(".UserEvaluationMetric"):
        parts = w.split(".")
        if len(parts) >= 3 and parts[-2] == "metric_node":
            pkg = (parts[-3] or "").strip()
            if not pkg.startswith("em_"):
                return None
            # user_metric_package_dir encodes metric_id by replacing '-' with '_'
            # so we restore '-' and validate it as a UUID.
            candidate = pkg[3:].replace("_", "-")
            try:
                return str(uuid.UUID(candidate))
            except ValueError:
                return None
    return None


def builtin_metric_id_from_workflow_node_fqn(workflow_type_id: str) -> str | None:
    """Map built-in metric node class FQN to registry metric id."""
    w = (workflow_type_id or "").strip()
    if w.endswith(".BuiltinMeanIcNode") and "metric_builtin_mean_ic" in w:
        return "builtin_mean_ic"
    if w.endswith(".BuiltinMeanReturnSpreadNode") and "metric_builtin_mean_return_spread" in w:
        return "builtin_mean_return_spread"
    return None


def default_metric_source(name: str, metric_id: str) -> str:
    label = (name or "metric").strip() or "metric"
    label_js = json.dumps(label, ensure_ascii=False)
    return f"""# User evaluation metric: {label}
from __future__ import annotations

from typing import Any

import pandas as pd
from app.evaluation.metric_workflow.user_metric_workflow import RegistryUserEvaluationMetric
from workflow import workflow_node, workflow_socket

REGISTRY_METRIC_ID = "{metric_id}"


@workflow_node(
    label={label_js},
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
class UserEvaluationMetric(RegistryUserEvaluationMetric):
    REGISTRY_METRIC_ID = REGISTRY_METRIC_ID

    def evaluate(self, clean_factor: pd.DataFrame, **kwargs: Any) -> tuple[Any, dict[str, Any], dict[str, Any]]:
        _ = clean_factor
        return 0.0, {{}}, {{}}
"""
