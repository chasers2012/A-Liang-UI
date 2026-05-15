from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.common.frames_workflow import execute_frames_workflow
from app.data_sync.schemas import (
    DataSyncRunResult,
    DataSyncTargetWriteResult,
    DataSyncTaskPayload,
)
from app.datasource.controller import get_datasource
from app.datasource.registry import DataSourceItemsRegistry


def _earliest_latest_date_from_targets(targets: list[Any]) -> str | None:
    dates: list[str] = []
    for inst in targets:
        date_col = inst.date_column
        df = inst.load_frame(columns=[date_col])
        if df.empty or date_col not in df.columns:
            continue
        mx = pd.to_datetime(df[date_col], errors="coerce").max()
        if not pd.isna(mx):
            dates.append(pd.Timestamp(mx).date().isoformat())
    return min(dates) if dates else None


def _load_targets_bundle(target_ids: list[str]) -> list[Any]:
    out: list[Any] = []
    for tid in target_ids:
        row = DataSourceItemsRegistry.get_item(tid)
        if row is None:
            raise ValueError(f"目标数据源不存在: {tid}")
        inst = get_datasource(tid)
        if inst is None:
            raise ValueError(f"目标数据源不存在: {tid}")
        out.append(inst)
    return out


def _frames_by_target_from_workflow(
    workflow_out: dict[str, Any],
    targets: list[Any],
) -> dict[str, pd.DataFrame]:
    frames_by_target: dict[str, pd.DataFrame] = {}
    frames_out = workflow_out.get("frames")
    if isinstance(frames_out, pd.DataFrame):
        for inst in targets:
            frames_by_target[inst.id] = frames_out
        return frames_by_target
    for inst in targets:
        val = workflow_out.get(inst.id)
        if not isinstance(val, pd.DataFrame):
            raise ValueError(f"工作流缺少目标输出: {inst.id}")
        frames_by_target[inst.id] = val
    return frames_by_target


def _write_sync_to_targets(
    frames_by_target: dict[str, pd.DataFrame],
    targets: list[Any],
) -> tuple[list[DataSyncTargetWriteResult], int]:
    rows_written_by_target: list[DataSyncTargetWriteResult] = []
    rows_written = 0
    for inst in targets:
        df_out = frames_by_target[inst.id]
        date_col = inst.date_column
        if date_col not in df_out.columns:
            raise ValueError(
                f"目标 {inst.id} 的同步结果缺少日期列 {date_col!r}（来自目标自身配置），"
                "无法推断同步进度；请在 sync_workflow 中保留该列"
            )
        n = inst.write_sync_dataframe(df_out)
        rows_written_by_target.append(
            DataSyncTargetWriteResult(target_datasource_id=inst.id, rows_written=n)
        )
        rows_written += n
    return rows_written_by_target, rows_written


def _datasource_sync_run(sync_payload: DataSyncTaskPayload) -> DataSyncRunResult:
    source_ids = sync_payload.source_ids
    target_ids = sync_payload.target_ids
    wf_json = sync_payload.workflow_json()
    if not wf_json:
        raise ValueError("没有配置 sync_workflow，无法继续同步")

    targets = _load_targets_bundle(target_ids)

    earliest_target_date = _earliest_latest_date_from_targets(targets)
    end_date = sync_payload.end_date or datetime.now(timezone.utc).date().isoformat()
    start_date = earliest_target_date or sync_payload.initial_start_date

    raw_frames: dict[str, pd.DataFrame] = {}
    for sid in source_ids:
        inst = get_datasource(sid)
        if inst is None:
            raise ValueError(f"源数据源不存在: {sid}")
        raw_frames[sid] = inst.load_frame(start_date=start_date, end_date=end_date)
    rows_read = sum(len(df) for df in raw_frames.values())
    if rows_read == 0:
        return DataSyncRunResult(
            rows_read=rows_read,
            rows_written=0,
            rows_written_by_target=[],
            start_date=start_date,
            end_date=end_date,
            source_datasource_ids=source_ids,
            target_datasource_ids=target_ids,
        )

    workflow_out = execute_frames_workflow(wf_json, raw_frames)
    frames_by_target = _frames_by_target_from_workflow(workflow_out, targets)
    rows_written_by_target, rows_written = _write_sync_to_targets(frames_by_target, targets)
    return DataSyncRunResult(
        rows_read=rows_read,
        rows_written=rows_written,
        rows_written_by_target=rows_written_by_target,
        start_date=start_date,
        end_date=end_date,
        source_datasource_ids=source_ids,
        target_datasource_ids=target_ids,
    )


def datasource_sync_handler(payload: dict[str, Any]) -> dict[str, Any]:
    job_payload = {k: v for k, v in payload.items() if k != "_scheduler"}
    if not job_payload:
        raise ValueError("数据同步任务 payload 不能为空")
    sync_payload = DataSyncTaskPayload.model_validate(job_payload)
    return _datasource_sync_run(sync_payload).model_dump(mode="json")
