"""Shared handler logic for all viz nodes (passthrough in → out)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pandas as pd
from workflow import WorkflowNode


def _jsonable_metric_value(val: Any) -> Any:
    if isinstance(val, pd.Series):
        from app.run_evaluation.runner import _series_to_period_dict

        return _series_to_period_dict(val)
    if isinstance(val, dict):
        return {str(k): float(v) for k, v in val.items() if not pd.isna(v)}
    return val


class VizNodeBase:
    """Common execute logic: passthrough ``in`` → ``out`` and record the result."""

    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
        ctx: Any,
    ) -> dict[str, Any]:
        val = inputs["in"]
        ctx["metric_results"][node.id] = {"out": _jsonable_metric_value(val)}
        return {"out": val}
