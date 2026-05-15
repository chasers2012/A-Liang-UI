from __future__ import annotations

import json
from typing import Any

import pandas as pd
from workflow import WorkflowExecutor


def _workflow_json_str(workflow: str | dict[str, Any]) -> str:
    wf_str = (
        workflow
        if isinstance(workflow, str)
        else json.dumps(workflow, ensure_ascii=False, default=str)
    )
    if not str(wf_str).strip():
        raise ValueError("workflow 不能为空")
    return wf_str


def _frames_workflow_inputs(raw_frames: dict[str, pd.DataFrame]) -> dict[str, Any]:
    """Bundled ``frames`` map plus per-key DataFrames as workflow inputs."""
    return {"frames": raw_frames, **raw_frames}


def execute_frames_workflow(
    workflow: str | dict[str, Any],
    raw_frames: dict[str, pd.DataFrame],
) -> dict[str, Any]:
    """Run a workflow graph and return its ``workflow_outputs`` mapping."""
    wf_str = _workflow_json_str(workflow)
    executor = WorkflowExecutor()
    node_results = executor.execute(
        wf_str,
        workflow_inputs=_frames_workflow_inputs(raw_frames),
    )
    workflow_out = (
        (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
    )
    return workflow_out if isinstance(workflow_out, dict) else {}


def execute_frames_dataframe_workflow(
    workflow: str | dict[str, Any],
    raw_frames: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """
    Run a persisted graph: ``frames`` + per-key DataFrames in workflow_inputs,
    expect ``workflow_outputs.frames`` as a single DataFrame.
    """
    workflow_out = execute_frames_workflow(workflow, raw_frames)
    frames_out = workflow_out.get("frames")
    if frames_out is None:
        raise ValueError("工作流没有输出 workflow_outputs.frames")
    if not isinstance(frames_out, pd.DataFrame):
        raise ValueError("工作流输出 frames 必须是一个 DataFrame")
    return frames_out
