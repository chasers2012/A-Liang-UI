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
    """数据集预处理与数据同步共用：整包 frames 映射 + 按数据源 id 拆分的 DataFrame。"""
    return {"frames": raw_frames, **raw_frames}


def execute_frames_dataframe_workflow(
    workflow: str | dict[str, Any],
    raw_frames: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """
    Run a persisted preprocessing-style graph: ``frames`` + per-key DataFrames in
    ``workflow_inputs``, expect ``workflow_outputs.frames`` as a single DataFrame.
    """
    wf_str = _workflow_json_str(workflow)
    executor = WorkflowExecutor()
    node_results = executor.execute(
        wf_str,
        workflow_inputs=_frames_workflow_inputs(raw_frames),
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


def execute_datasource_sync_workflow(
    workflow: str | dict[str, Any],
    raw_frames: dict[str, pd.DataFrame],
    target_ids: list[str],
) -> dict[str, pd.DataFrame]:
    """
    数据同步工作流：输入 socket 名为源数据源 id，输出 socket 名为目标数据源 id。
    兼容旧图：若仅有 ``workflow_outputs.frames``，则同一 DataFrame 写入全部目标。
    """
    if not target_ids:
        raise ValueError("target_ids 不能为空")

    wf_str = _workflow_json_str(workflow)
    executor = WorkflowExecutor()
    node_results = executor.execute(
        wf_str,
        workflow_inputs=_frames_workflow_inputs(raw_frames),
    )
    workflow_out = (
        (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
    )

    frames_out = workflow_out.get("frames")
    if isinstance(frames_out, pd.DataFrame):
        return dict.fromkeys(target_ids, frames_out)

    by_target: dict[str, pd.DataFrame] = {}
    for tid in target_ids:
        val = workflow_out.get(tid)
        if isinstance(val, pd.DataFrame):
            by_target[tid] = val

    if by_target:
        missing = [t for t in target_ids if t not in by_target]
        if missing:
            raise ValueError(f"工作流缺少目标输出: {', '.join(missing)}")
        return by_target

    single_dfs = [(k, v) for k, v in workflow_out.items() if isinstance(v, pd.DataFrame)]
    if len(single_dfs) == 1:
        return dict.fromkeys(target_ids, single_dfs[0][1])

    raise ValueError(
        "工作流未产出可写入目标的 DataFrame；请将处理结果连到各目标数据源输出，"
        "或使用名为 frames 的单一输出（将写入全部目标）。"
    )
