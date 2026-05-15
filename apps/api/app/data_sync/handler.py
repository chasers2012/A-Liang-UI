from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.data_sync.schemas import (
    DataSyncRunResult,
    DataSyncTargetWriteResult,
    DataSyncTaskPayload,
)
from app.data_sync.workflow import execute_datasource_sync_workflow
from app.datasource.controller import get_datasource
from app.datasource.plugins import get_datasource_plugin
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import merged_write_flat_dict_from_storage


def _watermark_from_targets(target_ids: list[str], date_col: str) -> str | None:
    dates: list[str] = []
    for tid in target_ids:
        inst = get_datasource(tid)
        if inst is None:
            raise ValueError(f"数据源不存在: {tid}")
        df = inst.load_frame(columns=[date_col])
        if df.empty or date_col not in df.columns:
            continue
        mx = pd.to_datetime(df[date_col], errors="coerce").max()
        if not pd.isna(mx):
            dates.append(pd.Timestamp(mx).date().isoformat())
    return min(dates) if dates else None


def _resolve_sync_columns(
    source_ids: list[str],
    targets: list[tuple[str, str, dict[str, Any]]],
) -> list[str]:
    inst = get_datasource(source_ids[0])
    if inst is None:
        raise ValueError(f"源数据源不存在: {source_ids[0]}")
    common = set(inst.list_columns())
    for sid in source_ids[1:]:
        src = get_datasource(sid)
        if src is None:
            raise ValueError(f"源数据源不存在: {sid}")
        common &= set(src.list_columns())

    for _tid, ttype, tplain in targets:
        cached = [
            x.strip() for x in (tplain.get("columns") or {}).get("columns") or [] if str(x).strip()
        ]
        if cached:
            common &= set(cached)
            continue
        plug = get_datasource_plugin(ttype)
        phys = plug.spec.list_sync_target_physical_columns(
            tplain.get("connection") or {},
            tplain.get("columns") or {},
        )
        if not phys:
            raise ValueError("目标数据源无法枚举物理列以解析同步列；请完善各数据源的列缓存。")
        common &= set(phys)

    if not common:
        raise ValueError("无法解析待同步列：请完善各数据源的列缓存。")
    return sorted(common, key=lambda x: (x.lower(), x))


def _load_targets_bundle(target_ids: list[str]) -> list[tuple[str, str, dict[str, Any]]]:
    out: list[tuple[str, str, dict[str, Any]]] = []
    for tid in target_ids:
        row = DataSourceItemsRegistry.get_item(tid)
        if row is None:
            raise ValueError(f"目标数据源不存在: {tid}")
        plug = get_datasource_plugin(row.type)
        plain = plug.spec.decrypt_storage_config(row.config or {})
        if not plug.spec.validate_write_config(
            merged_write_flat_dict_from_storage(plain)
        ).write_enabled:
            raise ValueError(f"目标数据源未开启 write_enabled，拒绝同步写入: {tid}")
        out.append((tid, row.type, plain))
    return out


def _datasource_sync_run(sync_payload: DataSyncTaskPayload) -> DataSyncRunResult:  # noqa: C901
    source_ids = sync_payload.source_ids
    target_ids = sync_payload.target_ids
    wf_json = sync_payload.workflow_json()
    targets = _load_targets_bundle(target_ids)
    columns = _resolve_sync_columns(source_ids, targets)

    src_inst = get_datasource(source_ids[0])
    if src_inst is None:
        raise ValueError("主源数据源不存在")
    date_col = src_inst.date_column
    if date_col not in columns:
        columns.append(date_col)

    synced_through = _watermark_from_targets(target_ids, date_col)
    end_date = sync_payload.end_date or datetime.now(timezone.utc).date().isoformat()
    start_date = synced_through or sync_payload.initial_start_date

    raw_frames: dict[str, pd.DataFrame] = {}
    for sid in source_ids:
        inst = get_datasource(sid)
        if inst is None:
            raise ValueError(f"源数据源不存在: {sid}")
        raw_frames[sid] = inst.load_frame(columns=columns, start_date=start_date, end_date=end_date)
    rows_read = sum(len(df) for df in raw_frames.values())

    rows_written_by_target: list[DataSyncTargetWriteResult] = []
    rows_written = 0
    watermark_date = synced_through

    if rows_read:
        if wf_json:
            frames_by_target = execute_datasource_sync_workflow(wf_json, raw_frames, target_ids)
        else:
            frames_by_target = dict.fromkeys(target_ids, raw_frames[source_ids[0]])

        for tid, df_out in frames_by_target.items():
            if date_col not in df_out.columns:
                raise ValueError(
                    f"目标 {tid} 的同步结果缺少日期列 {date_col!r}（来自主源），"
                    "无法推断同步进度；请在 sync_workflow 中保留该列"
                )

        for tid, ttype, tgt_plain in targets:
            df_out = frames_by_target[tid]
            n = get_datasource_plugin(ttype).spec.write_sync_dataframe(
                connection_config=tgt_plain.get("connection") or {},
                columns_config=tgt_plain.get("columns") or {},
                df=df_out,
            )
            rows_written_by_target.append(
                DataSyncTargetWriteResult(target_datasource_id=tid, rows_written=n)
            )
            rows_written += n
            if not df_out.empty and date_col in df_out.columns:
                mx = pd.to_datetime(df_out[date_col], errors="coerce").max()
                if not pd.isna(mx):
                    d = pd.Timestamp(mx).date().isoformat()
                    watermark_date = d if watermark_date is None else max(watermark_date, d)

    return DataSyncRunResult(
        rows_read=rows_read,
        rows_written=rows_written,
        rows_written_by_target=rows_written_by_target,
        start_date=start_date,
        end_date=end_date,
        watermark_date=watermark_date,
        source_datasource_ids=source_ids,
        target_datasource_ids=target_ids,
    )


def datasource_sync_handler(payload: dict[str, Any]) -> dict[str, Any]:
    job_payload = {k: v for k, v in payload.items() if k != "_scheduler"}
    if not job_payload:
        raise ValueError("数据同步任务 payload 不能为空")
    sync_payload = DataSyncTaskPayload.model_validate(job_payload)
    return _datasource_sync_run(sync_payload).model_dump(mode="json")
