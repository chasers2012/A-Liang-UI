from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.common.frames_workflow import execute_datasource_sync_workflow
from app.data_sync.registry import DataSyncRegistry
from app.data_sync.schemas import DataSyncTaskPayload
from app.datasource.controller import get_datasource
from app.datasource.plugins import get_datasource_plugin
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import merged_write_flat_dict_from_storage


def _default_end_date_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _effective_sync_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Merge stored task config with per-job overrides (cron jobs start with empty job payload)."""
    meta = payload.get("_scheduler") or {}
    task_id = str(meta.get("task_id") or "").strip()
    stored: dict[str, Any] = {}
    if task_id:
        row = DataSyncRegistry.get_task(task_id)
        if row is not None:
            stored = row.payload.model_dump(mode="json", by_alias=True, exclude_none=True)
    overrides = {k: v for k, v in payload.items() if k != "_scheduler"}
    return {**stored, **overrides}


def _max_date_on_datasource(datasource_id: str, date_col: str) -> str | None:
    inst = get_datasource(datasource_id)
    if inst is None:
        raise ValueError(f"数据源不存在: {datasource_id}")
    df = inst.load_frame(columns=[date_col])
    if df.empty or date_col not in df.columns:
        return None
    ser = pd.to_datetime(df[date_col], errors="coerce")
    mx = ser.max()
    if pd.isna(mx):
        return None
    return pd.Timestamp(mx).date().isoformat()


def _watermark_from_targets(target_ids: list[str], date_col: str) -> str | None:
    """Synced-through date from targets (min of per-target max dates when multiple targets)."""
    dates: list[str] = []
    for tid in target_ids:
        d = _max_date_on_datasource(tid, date_col)
        if d is not None:
            dates.append(d)
    if not dates:
        return None
    return min(dates)


def _max_date_in_frames(frames: list[pd.DataFrame], date_col: str) -> str | None:
    best: str | None = None
    for df in frames:
        if df.empty or date_col not in df.columns:
            continue
        ser = pd.to_datetime(df[date_col], errors="coerce")
        mx = ser.max()
        if pd.isna(mx):
            continue
        d = pd.Timestamp(mx).date().isoformat()
        if best is None or d > best:
            best = d
    return best


def _watermark_after_batch(
    synced_through: str | None,
    batch_frames: list[pd.DataFrame],
    date_col: str,
) -> str | None:
    batch_max = _max_date_in_frames(batch_frames, date_col)
    if batch_max is None:
        return synced_through
    if synced_through is None:
        return batch_max
    return max(synced_through, batch_max)


def _nested_columns_list(plain: dict[str, Any]) -> list[str]:
    raw = dict(plain.get("columns") or {}).get("columns") or []
    return [str(x).strip() for x in raw if str(x).strip()]


def _source_column_set(source_id: str) -> set[str]:
    inst = get_datasource(source_id)
    if inst is None:
        raise ValueError(f"源数据源不存在: {source_id}")
    return set(inst.list_columns())


def _target_column_set(target_type: str, target_plain: dict[str, Any]) -> set[str]:
    tgt_cached = set(_nested_columns_list(target_plain))
    if tgt_cached:
        return tgt_cached
    tgt_conn = dict(target_plain.get("connection") or {})
    tgt_cols = dict(target_plain.get("columns") or {})
    tgt_plugin = get_datasource_plugin(target_type)
    phys = tgt_plugin.spec.list_sync_target_physical_columns(tgt_conn, tgt_cols)
    if phys is None:
        raise ValueError("目标数据源无法枚举物理列以解析同步列；请完善各数据源的列缓存。")
    return set(phys)


def _resolve_sync_columns(
    source_ids: list[str],
    targets: list[tuple[str, str, dict[str, Any]]],
) -> list[str]:
    common: set[str] | None = None
    for sid in source_ids:
        s = _source_column_set(sid)
        common = s if common is None else common & s

    assert common is not None

    for _tid, ttype, tplain in targets:
        common = common & _target_column_set(ttype, tplain)

    if not common:
        raise ValueError("无法解析待同步列：请完善各数据源的列缓存。")
    return sorted(common, key=lambda x: (x.lower(), x))


def _start_end_dates(synced_through: str | None, payload: dict[str, Any]) -> tuple[str | None, str]:
    end_date = str(payload.get("end_date") or "").strip() or _default_end_date_str()
    if synced_through:
        return synced_through, end_date
    init = str(payload.get("initial_start_date") or "").strip()
    return (init or None), end_date


def _load_targets_bundle(target_ids: list[str]) -> list[tuple[str, str, dict[str, Any]]]:
    out: list[tuple[str, str, dict[str, Any]]] = []
    for tid in target_ids:
        row = DataSourceItemsRegistry.get_item(tid)
        if row is None:
            raise ValueError(f"目标数据源不存在: {tid}")
        plug = get_datasource_plugin(str(row.type))
        plain = plug.spec.decrypt_storage_config(dict(row.config or {}))
        write_flat = merged_write_flat_dict_from_storage(plain)
        tgt_write = plug.spec.validate_write_config(write_flat)
        if not tgt_write.write_enabled:
            raise ValueError(f"目标数据源未开启 write_enabled，拒绝同步写入: {tid}")
        out.append((tid, str(row.type), plain))
    return out


def _load_raw_frames(
    source_ids: list[str],
    *,
    columns: list[str],
    start_date: str | None,
    end_date: str,
) -> dict[str, pd.DataFrame]:
    raw_frames: dict[str, pd.DataFrame] = {}
    for sid in source_ids:
        inst = get_datasource(sid)
        if inst is None:
            raise ValueError(f"源数据源不存在: {sid}")
        raw_frames[sid] = inst.load_frame(columns=columns, start_date=start_date, end_date=end_date)
    return raw_frames


def _resolve_sync_output_frames(
    *,
    source_ids: list[str],
    target_ids: list[str],
    wf_json: str,
    raw_frames: dict[str, pd.DataFrame],
) -> dict[str, pd.DataFrame]:
    if len(source_ids) == 1 and not wf_json:
        df = raw_frames[source_ids[0]]
        return dict.fromkeys(target_ids, df)
    assert wf_json
    return execute_datasource_sync_workflow(wf_json, raw_frames, target_ids)


def _write_frames_by_target(
    targets: list[tuple[str, str, dict[str, Any]]],
    frames_by_target: dict[str, pd.DataFrame],
) -> tuple[list[dict[str, Any]], int]:
    rows_written_by_target: list[dict[str, Any]] = []
    rows_written = 0
    for tid, ttype, tgt_plain in targets:
        df_out = frames_by_target.get(tid)
        if df_out is None:
            raise ValueError(f"缺少目标数据源 {tid} 的同步结果")
        tgt_plugin = get_datasource_plugin(ttype)
        try:
            n = tgt_plugin.spec.write_sync_dataframe(
                connection_config=dict(tgt_plain.get("connection") or {}),
                columns_config=dict(tgt_plain.get("columns") or {}),
                df=df_out,
            )
        except NotImplementedError as e:
            raise ValueError(str(e) or "目标数据源不支持同步写入") from e
        rows_written_by_target.append({"target_datasource_id": tid, "rows_written": n})
        rows_written += int(n)
    return rows_written_by_target, rows_written


def _sync_run_result(
    *,
    rows_read: int,
    rows_written: int,
    rows_written_by_target: list[dict[str, Any]],
    source_ids: list[str],
    target_ids: list[str],
    start_date: str | None,
    end_date: str,
    watermark_date: str | None,
) -> dict[str, Any]:
    return {
        "rows_read": rows_read,
        "rows_written": rows_written,
        "rows_written_by_target": rows_written_by_target,
        "start_date": start_date,
        "end_date": end_date,
        "watermark_date": watermark_date,
        "source_datasource_ids": source_ids,
        "target_datasource_ids": target_ids,
    }


def _rows_read_count(raw_frames: dict[str, pd.DataFrame]) -> int:
    return sum(len(f) for f in raw_frames.values())


def _datasource_sync_run(
    payload: dict[str, Any],
    *,
    source_ids: list[str],
    target_ids: list[str],
    wf_json: str,
) -> dict[str, Any]:
    targets = _load_targets_bundle(target_ids)

    columns = _resolve_sync_columns(source_ids, targets)

    primary_src_id = source_ids[0]
    src_inst = get_datasource(primary_src_id)
    if src_inst is None:
        raise ValueError("主源数据源不存在")
    date_col = src_inst.date_column
    if date_col not in columns:
        columns = [*columns, date_col]

    synced_through = _watermark_from_targets(target_ids, date_col)
    start_date, end_date = _start_end_dates(synced_through, payload)
    result_kw = {
        "source_ids": source_ids,
        "target_ids": target_ids,
        "start_date": start_date,
        "end_date": end_date,
    }

    raw_frames = _load_raw_frames(
        source_ids, columns=columns, start_date=start_date, end_date=end_date
    )
    rows_read = _rows_read_count(raw_frames)

    if not any(len(f) for f in raw_frames.values()):
        return _sync_run_result(
            rows_read=0,
            rows_written=0,
            rows_written_by_target=[],
            watermark_date=synced_through,
            **result_kw,
        )

    frames_by_target = _resolve_sync_output_frames(
        source_ids=source_ids,
        target_ids=target_ids,
        wf_json=wf_json,
        raw_frames=raw_frames,
    )

    if not any(len(f) for f in frames_by_target.values()):
        return _sync_run_result(
            rows_read=rows_read,
            rows_written=0,
            rows_written_by_target=[],
            watermark_date=synced_through,
            **result_kw,
        )

    for tid, df_out in frames_by_target.items():
        if date_col not in df_out.columns:
            raise ValueError(
                f"目标 {tid} 的同步结果缺少日期列 {date_col!r}（来自主源），"
                "无法推断同步进度；请在 sync_workflow 中保留该列"
            )

    rows_written_by_target, rows_written = _write_frames_by_target(targets, frames_by_target)

    watermark_date = _watermark_after_batch(
        synced_through, list(frames_by_target.values()), date_col
    )

    return _sync_run_result(
        rows_read=rows_read,
        rows_written=rows_written,
        rows_written_by_target=rows_written_by_target,
        watermark_date=watermark_date,
        **result_kw,
    )


def datasource_sync_handler(payload: dict[str, Any]) -> dict[str, Any]:
    effective = _effective_sync_payload(payload)
    sync_payload = DataSyncTaskPayload.model_validate(effective)
    sync_payload.validate_sync_rules()
    source_ids = sync_payload.source_ids
    target_ids = sync_payload.target_ids
    wf_json = sync_payload.workflow_json()
    return _datasource_sync_run(
        effective, source_ids=source_ids, target_ids=target_ids, wf_json=wf_json
    )
