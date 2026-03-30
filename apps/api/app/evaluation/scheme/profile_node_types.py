"""Profile API: evaluation workflow node types as a single catalog list.

Built-in node ``workflow_parameters`` come from :class:`workflow.Node.parameters`
when non-empty; otherwise from the metrics registry (user metrics and built-ins).
"""

from __future__ import annotations

from typing import Any

from app.evaluation.scheme.workflow_graph_types import (
    sorted_workflow_node_type_ids,
    workflow_node_definition,
)


def list_evaluation_profile_node_types_public() -> list[dict[str, Any]]:
    """Ordered node types from the evaluation catalog with API extras (unified iteration)."""
    out: list[dict[str, Any]] = []
    for nt in sorted_workflow_node_type_ids():
        spec = workflow_node_definition(nt)
        data = spec.serialize()
        out.append(data)
    return out
