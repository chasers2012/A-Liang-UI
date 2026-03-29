"""Shared handler logic for all viz nodes (passthrough in → out)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from evaluate.alphalens_panel_utils import jsonable_metric_value
from workflow import WorkflowNode


class VizNodeBase:
    """Common execute logic: passthrough ``in`` → ``out`` and record the result."""

    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
        ctx: Any,
    ) -> dict[str, Any]:
        val = inputs["in"]
        ctx["metric_results"][node.id] = {"out": jsonable_metric_value(val)}
        return {"out": val}
