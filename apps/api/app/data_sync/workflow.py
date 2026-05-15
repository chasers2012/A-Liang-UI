from __future__ import annotations

from typing import Any

import pandas as pd

from app.common.frames_workflow import execute_frames_workflow


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

    workflow_out = execute_frames_workflow(workflow, raw_frames)

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
