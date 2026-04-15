"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import traceback
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from workflow import WorkflowExecutor

from app.data_set.controller import get_data_set
from app.evaluation.profile.models import EvaluationProfileRow
from app.evaluation.run.models import EvaluationRunRow
from app.factors.controller import get_factor


def _to_jsonable_pandas(value: Any) -> Any | None:
    try:
        import pandas as pd

        if isinstance(value, pd.DataFrame):
            frame = value.copy()
            frame.columns = [str(c) for c in frame.columns]
            if isinstance(frame.index, pd.MultiIndex):
                frame = frame.reset_index()
            else:
                frame = frame.reset_index(names=(frame.index.name or "index"))
            return _to_jsonable(frame.to_dict(orient="records"))

        if isinstance(value, pd.Series):
            series = value.copy()
            if isinstance(series.index, pd.MultiIndex):
                frame = series.rename("value").reset_index()
                return _to_jsonable(frame.to_dict(orient="records"))
            return _to_jsonable([{"index": idx, "value": val} for idx, val in series.items()])

        if isinstance(value, pd.Index):
            return _to_jsonable(list(value))
    except Exception:
        return None

    return None


def _to_jsonable_numpy(value: Any) -> Any | None:
    try:
        import numpy as np

        if isinstance(value, np.ndarray):
            return _to_jsonable(value.tolist())
        if isinstance(value, np.generic):
            return _to_jsonable(value.item())
    except Exception:
        return None

    return None


def _to_jsonable(value: Any) -> Any:
    """Recursively convert pandas/numpy-rich values into JSON-serializable payloads."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass

    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(v) for v in value]

    pandas_converted = _to_jsonable_pandas(value)
    if pandas_converted is not None:
        return pandas_converted

    numpy_converted = _to_jsonable_numpy(value)
    if numpy_converted is not None:
        return numpy_converted

    return str(value)


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRow,
    *,
    data_set_id: str | None = None,
) -> EvaluationRunRow:
    started_at = datetime.now(timezone.utc)

    factor = get_factor(factor_id)

    workflow_inputs: dict[str, Any] = {"factor": factor}
    override = (data_set_id or "").strip()
    if override:
        ds = get_data_set(override)
        if ds is not None:
            workflow_inputs["data_set"] = ds

    executor = WorkflowExecutor()

    try:
        node_results = executor.execute(
            profile.workflow,
            workflow_inputs=workflow_inputs,
        )
        workflow_result = (
            (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
        )
        final_result = _to_jsonable((workflow_result or {}).get("result"))
    except ValueError as e:
        return EvaluationRunRow(
            id=uuid4().hex,
            start_at=started_at,
            end_at=datetime.now(timezone.utc),
            factor_id=factor_id,
            error=str(e),
            evaluation_profile_id=profile.id,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return EvaluationRunRow(
            id=uuid4().hex,
            start_at=started_at,
            end_at=datetime.now(timezone.utc),
            factor_id=factor_id,
            error=f"{e}\n{tb}",
            evaluation_profile_id=profile.id,
        )

    return EvaluationRunRow(
        id=uuid4().hex,
        start_at=started_at,
        end_at=datetime.now(timezone.utc),
        factor_id=factor_id,
        evaluation_profile_id=profile.id,
        results=final_result,
    )
