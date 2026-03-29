"""Validate evaluation workflow graph — thin wrapper over workflow.validate."""

from __future__ import annotations

from collections.abc import Set as AbstractSet

from workflow import validate_workflow_graph as _validate_generic

from .profile_schemas import EvaluationWorkflow
from .workflow_graph_types import workflow_node_definition_or_fail


def validate_workflow_graph(
    workflow: EvaluationWorkflow,
    *,
    allowed_types: AbstractSet[str],
) -> None:
    """Validate DAG structure and sockets for an evaluation workflow.

    Builds the ``node_type_specs`` mapping from ``allowed_types`` and delegates
    to :func:`workflow.validate_workflow_graph`.
    """
    specs = {t: workflow_node_definition_or_fail(t) for t in allowed_types}
    _validate_generic(workflow, node_type_specs=specs)
