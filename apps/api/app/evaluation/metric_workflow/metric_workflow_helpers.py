from __future__ import annotations

import uuid

USER_METRIC_WORKFLOW_ROOT = "workflow_nodes/evaluation"


def user_metric_package_dir(metric_id: str) -> str:
    return f"em_{metric_id.replace('-', '_')}"


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
