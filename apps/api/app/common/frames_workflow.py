from __future__ import annotations

import json
from typing import Any

import pandas as pd
from workflow import WorkflowExecutor


def execute_frames_dataframe_workflow(
    workflow: str | dict[str, Any],
    raw_frames: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """
    Run a persisted preprocessing-style graph: ``frames`` + per-key DataFrames in
    ``workflow_inputs``, expect ``workflow_outputs.frames`` as a single DataFrame.
    """
    wf_str = (
        workflow
        if isinstance(workflow, str)
        else json.dumps(workflow, ensure_ascii=False, default=str)
    )
    if not str(wf_str).strip():
        raise ValueError("workflow 不能为空")

    executor = WorkflowExecutor()
    node_results = executor.execute(
        wf_str,
        workflow_inputs={"frames": raw_frames, **raw_frames},
    )
    workflow_out = (
        (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
    )
    frames_out = (workflow_out or {}).get("frames")
    if frames_out is None:
        raise ValueError("工作流没有输出 workflow_outputs.frames")
    if not isinstance(frames_out, pd.DataFrame):
        raise ValueError("工作流输出 frames 必须是一个 DataFrame")
    return frames_out
