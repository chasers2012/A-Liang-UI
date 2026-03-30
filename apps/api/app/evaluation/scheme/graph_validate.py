"""Validate evaluation workflow graph — thin wrapper over workflow.validate."""

from __future__ import annotations

from collections.abc import Set as AbstractSet

from workflow import validate_workflow_graph_against_registry

from .profile_schemas import EvaluationWorkflow
from .workflow_graph_types import get_evaluation_node_registry


def validate_workflow_graph(
    workflow: EvaluationWorkflow,
    *,
    allowed_types: AbstractSet[str],
) -> None:
    """Validate DAG structure and sockets for an evaluation workflow.

    ``node.type`` must be the registry key (class ``module.qualname``) and in ``allowed_types``.
    """
    validate_workflow_graph_against_registry(
        workflow,
        get_evaluation_node_registry(),
        allowed_types=allowed_types,
    )
