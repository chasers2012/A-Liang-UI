from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from workflow.schemas import WorkflowGraphPersisted

from app.common.datetime_utils import utc_now_iso
from app.common.frames_workflow import execute_datasource_sync_workflow
from app.datasource.controller import get_datasource
from app.datasource.plugins import get_datasource_plugin
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import merged_write_flat_dict_from_storage
from app.datasource.sync_models import DataSourceSyncCursorRow
from app.persistence.sqlite_db import get_session
from app.scheduler.handlers import register_task_handler


def _default_end_date_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _resolve_cursor_key(payload: dict[str, Any]) -> str:
    meta = payload.get("_scheduler") or {}
    tid = meta.get("task_id")
    if tid is not None and str(tid).strip():
        return str(tid).strip()
    ck = str(payload.get("cursor_key", "")).strip()
    if not ck:
        raise ValueError(
            "缺少 cursor_key：请通过 Scheduler 任务触发（自动注入 task_id），或在 payload 中显式传入 cursor_key"
        )
    return ck


def _nested_columns_list(plain: dict[str, Any]) -> list[str]:
    raw = dict(plain.get("columns") or {}).get("columns") or []
    return [str(x).strip() for x in raw if str(x).strip()]


def _normalize_datasource_ids(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str) and raw.strip():
        return [raw.strip()]
    if isinstance(raw, list):
        out: list[str] = []
        seen: set[str] = set()
        for x in raw:
            s = str(x).strip()
            if not s or s in seen:
                continue
            seen.add(s)
            out.append(s)
        return out
    return []


def _payload_source_ids(payload: dict[str, Any]) -> list[str]:
    ids = _normalize_datasource_ids(payload.get("source_datasource_ids"))
    if ids:
        return ids
    one = str(payload.get("source_datasource_id", "")).strip()
    return [one] if one else []


def _payload_target_ids(payload: dict[str, Any]) -> list[str]:
    ids = _normalize_datasource_ids(payload.get("target_datasource_ids"))
    if ids:
        return ids
    one = str(payload.get("target_datasource_id", "")).strip()
    return [one] if one else []


def _payload_sync_workflow_dict(payload: dict[str, Any]) -> dict[str, Any]:
    raw = payload.get("sync_workflow")
    if raw is None:
        return {}
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return {}
        try:
            loaded = json.loads(s)
        except json.JSONDecodeError as e:
            raise ValueError("sync_workflow JSON 无效") from e
        if not isinstance(loaded, dict):
            raise ValueError("sync_workflow JSON 须为对象")
        return dict(loaded)
    if isinstance(raw, dict):
        return dict(raw)
    raise ValueError("sync_workflow 必须是对象或 JSON 字符串")


def _workflow_nodes_empty(workflow: dict[str, Any]) -> bool:
    nodes = workflow.get("nodes")
    if not isinstance(nodes, list):
        return True
    return len(nodes) == 0


def _validate_and_dump_sync_workflow(workflow: dict[str, Any]) -> str:
    if not workflow or _workflow_nodes_empty(workflow):
        return ""
    normalized = WorkflowGraphPersisted.model_validate(workflow).model_dump(by_alias=True)
    return json.dumps(normalized, ensure_ascii=False)


def _source_column_set(source_id: str, source_plain: dict[str, Any]) -> set[str]:
    cached = set(_nested_columns_list(source_plain))
    if cached:
        return cached
    src_inst = get_datasource(source_id)
    if src_inst is None:
        raise ValueError(f"源数据源不存在: {source_id}")
    return set(src_inst.list_columns())


def _target_column_set(target_type: str, target_plain: dict[str, Any]) -> set[str]:
    tgt_cached = set(_nested_columns_list(target_plain))
    if tgt_cached:
        return tgt_cached
    tgt_conn = dict(target_plain.get("connection") or {})
    tgt_cols = dict(target_plain.get("columns") or {})
    tgt_plugin = get_datasource_plugin(target_type)
    phys = tgt_plugin.spec.list_sync_target_physical_columns(tgt_conn, tgt_cols)
    if phys is None:
        raise ValueError(
            "目标数据源无法枚举物理列以解析同步列；请在任务 payload 中指定 columns，"
            "或为目标配置「字段」中的列缓存。"
        )
    return set(phys)


def _resolve_sync_columns_multi(
    *,
    payload_columns: list[str] | None,
    sources: list[tuple[str, dict[str, Any]]],
    targets: list[tuple[str, str, dict[str, Any]]],
) -> list[str]:
    if payload_columns:
        out = [str(c).strip() for c in payload_columns if str(c).strip()]
        if not out:
            raise ValueError("columns 数组为空")
        return out

    common: set[str] | None = None
    for sid, splain in sources:
        s = _source_column_set(sid, splain)
        common = s if common is None else common & s

    assert common is not None

    for _tid, ttype, tplain in targets:
        t = _target_column_set(ttype, tplain)
        common = common & t

    if not common:
        raise ValueError(
            "无法解析待同步列：多源/多目标时请在任务 payload 中指定 columns，或完善各数据源的列缓存"
        )
    return sorted(common, key=lambda x: (x.lower(), x))


def _get_cursor_row(cursor_key: str) -> DataSourceSyncCursorRow | None:
    with get_session() as session:
        return session.get(DataSourceSyncCursorRow, cursor_key)


def _cursor_sources_targets(row: DataSourceSyncCursorRow) -> tuple[list[str], list[str]]:
    if row.source_ids_json and row.target_ids_json:
        try:
            s = json.loads(row.source_ids_json)
            t = json.loads(row.target_ids_json)
        except json.JSONDecodeError:
            s, t = [], []
        if isinstance(s, list) and isinstance(t, list) and s and t:
            return [str(x) for x in s], [str(x) for x in t]
    return [row.source_datasource_id], [row.target_datasource_id]


def _save_cursor(
    *,
    cursor_key: str,
    scheduler_task_id: str | None,
    source_ids: list[str],
    target_ids: list[str],
    watermark_date: str | None,
) -> None:
    now = utc_now_iso()
    src_json = json.dumps(source_ids, ensure_ascii=False)
    tgt_json = json.dumps(target_ids, ensure_ascii=False)
    with get_session() as session:
        existing = session.get(DataSourceSyncCursorRow, cursor_key)
        if existing is not None:
            ex_s, ex_t = _cursor_sources_targets(existing)
            if ex_s != source_ids or ex_t != target_ids:
                raise ValueError(
                    "游标已绑定其他 source/target 数据源组合，请更换 cursor_key 或任务"
                )
            existing.watermark_date = watermark_date
            existing.updated_at = now
            existing.source_datasource_id = source_ids[0]
            existing.target_datasource_id = target_ids[0]
            existing.source_ids_json = src_json
            existing.target_ids_json = tgt_json
            if scheduler_task_id is not None:
                existing.scheduler_task_id = scheduler_task_id
            session.add(existing)
        else:
            session.add(
                DataSourceSyncCursorRow(
                    cursor_key=cursor_key,
                    scheduler_task_id=scheduler_task_id,
                    source_datasource_id=source_ids[0],
                    target_datasource_id=target_ids[0],
                    source_ids_json=src_json,
                    target_ids_json=tgt_json,
                    watermark_date=watermark_date,
                    updated_at=now,
                )
            )
        session.commit()


def _scheduler_task_id_from_payload(payload: dict[str, Any]) -> str | None:
    meta = payload.get("_scheduler") or {}
    tid = meta.get("task_id")
    if tid is None or not str(tid).strip():
        return None
    return str(tid).strip()


def _payload_column_override(payload: dict[str, Any]) -> list[str] | None:
    raw_cols = payload.get("columns")
    if isinstance(raw_cols, list) and raw_cols:
        return [str(c) for c in raw_cols]
    return None


def _start_end_dates(
    cur: DataSourceSyncCursorRow | None, payload: dict[str, Any]
) -> tuple[str | None, str]:
    end_date = str(payload.get("end_date") or "").strip() or _default_end_date_str()
    if cur is not None and cur.watermark_date:
        return cur.watermark_date, end_date
    init = str(payload.get("initial_start_date") or "").strip()
    return (init or None), end_date


def _compute_watermark(
    df: pd.DataFrame, date_col: str, cur: DataSourceSyncCursorRow | None
) -> str | None:
    ser = pd.to_datetime(df[date_col], errors="coerce")
    mx = ser.max()
    if pd.isna(mx):
        return cur.watermark_date if cur else None
    return pd.Timestamp(mx).date().isoformat()


def _compute_watermark_from_frames(
    frames: list[pd.DataFrame],
    date_col: str,
    cur: DataSourceSyncCursorRow | None,
) -> str | None:
    best: str | None = cur.watermark_date if cur else None
    for df in frames:
        if df.empty or date_col not in df.columns:
            continue
        wm = _compute_watermark(df, date_col, cur)
        if wm and (best is None or wm > best):
            best = wm
    return best


def _load_sources_plain(source_ids: list[str]) -> list[tuple[str, dict[str, Any]]]:
    out: list[tuple[str, dict[str, Any]]] = []
    for sid in source_ids:
        row = DataSourceItemsRegistry.get_item(sid)
        if row is None:
            raise ValueError(f"源数据源不存在: {sid}")
        plug = get_datasource_plugin(str(row.type))
        plain = plug.spec.decrypt_storage_config(dict(row.config or {}))
        out.append((sid, plain))
    return out


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
    sources: list[tuple[str, dict[str, Any]]],
    *,
    columns: list[str],
    start_date: str | None,
    end_date: str,
) -> dict[str, pd.DataFrame]:
    raw_frames: dict[str, pd.DataFrame] = {}
    for sid, _splain in sources:
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
    for tid, _ttype, tgt_plain in targets:
        df_out = frames_by_target.get(tid)
        if df_out is None:
            raise ValueError(f"缺少目标数据源 {tid} 的同步结果")
        trow = DataSourceItemsRegistry.get_item(tid)
        if trow is None:
            raise ValueError(f"目标数据源不存在: {tid}")
        tgt_plugin = get_datasource_plugin(str(trow.type))
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


def _sync_result_base(
    *,
    source_ids: list[str],
    target_ids: list[str],
    cursor_key: str,
    start_date: str | None,
    end_date: str,
    watermark_date: str | None,
) -> dict[str, Any]:
    return {
        "start_date": start_date,
        "end_date": end_date,
        "watermark_date": watermark_date,
        "cursor_key": cursor_key,
        "source_datasource_ids": source_ids,
        "target_datasource_ids": target_ids,
    }


def _datasource_sync_run(
    payload: dict[str, Any],
    *,
    source_ids: list[str],
    target_ids: list[str],
    wf_json: str,
) -> dict[str, Any]:
    cursor_key = _resolve_cursor_key(payload)
    scheduler_task_id = _scheduler_task_id_from_payload(payload)

    sources = _load_sources_plain(source_ids)
    targets = _load_targets_bundle(target_ids)

    columns = _resolve_sync_columns_multi(
        payload_columns=_payload_column_override(payload),
        sources=sources,
        targets=targets,
    )
    if not columns:
        raise ValueError("无法解析待同步列")

    primary_src_id = source_ids[0]
    src_inst = get_datasource(primary_src_id)
    if src_inst is None:
        raise ValueError("主源数据源不存在")
    date_col = src_inst.date_column
    if date_col not in columns:
        columns = [*columns, date_col]

    cur = _get_cursor_row(cursor_key)
    if cur is not None:
        ex_s, ex_t = _cursor_sources_targets(cur)
        if ex_s != source_ids or ex_t != target_ids:
            raise ValueError("游标记录与当前 source/target 数据源组合不一致")

    start_date, end_date = _start_end_dates(cur, payload)

    raw_frames = _load_raw_frames(
        sources, columns=columns, start_date=start_date, end_date=end_date
    )

    if not any(len(f) for f in raw_frames.values()):
        return {
            "rows_read": 0,
            "rows_written": 0,
            "rows_written_by_target": [],
            **_sync_result_base(
                source_ids=source_ids,
                target_ids=target_ids,
                cursor_key=cursor_key,
                start_date=start_date,
                end_date=end_date,
                watermark_date=cur.watermark_date if cur else None,
            ),
        }

    frames_by_target = _resolve_sync_output_frames(
        source_ids=source_ids,
        target_ids=target_ids,
        wf_json=wf_json,
        raw_frames=raw_frames,
    )

    if not any(len(f) for f in frames_by_target.values()):
        rows_read_raw = sum(len(f) for f in raw_frames.values())
        return {
            "rows_read": rows_read_raw,
            "rows_written": 0,
            "rows_written_by_target": [],
            **_sync_result_base(
                source_ids=source_ids,
                target_ids=target_ids,
                cursor_key=cursor_key,
                start_date=start_date,
                end_date=end_date,
                watermark_date=cur.watermark_date if cur else None,
            ),
        }

    for tid, df_out in frames_by_target.items():
        if date_col not in df_out.columns:
            raise ValueError(
                f"目标 {tid} 的同步结果缺少日期列 {date_col!r}（来自主源），"
                "无法维护游标；请在 sync_workflow 中保留该列"
            )

    new_watermark = _compute_watermark_from_frames(list(frames_by_target.values()), date_col, cur)

    rows_written_by_target, rows_written = _write_frames_by_target(targets, frames_by_target)

    _save_cursor(
        cursor_key=cursor_key,
        scheduler_task_id=scheduler_task_id,
        source_ids=source_ids,
        target_ids=target_ids,
        watermark_date=new_watermark,
    )

    rows_read = sum(len(f) for f in frames_by_target.values())

    return {
        "rows_read": rows_read,
        "rows_written": rows_written,
        "rows_written_by_target": rows_written_by_target,
        **_sync_result_base(
            source_ids=source_ids,
            target_ids=target_ids,
            cursor_key=cursor_key,
            start_date=start_date,
            end_date=end_date,
            watermark_date=new_watermark,
        ),
    }


def datasource_sync_handler(payload: dict[str, Any]) -> dict[str, Any]:
    source_ids = _payload_source_ids(payload)
    target_ids = _payload_target_ids(payload)
    if not source_ids or not target_ids:
        raise ValueError(
            "payload 须包含 source_datasource_id / target_datasource_id "
            "或 source_datasource_ids / target_datasource_ids（非空数组）"
        )

    if set(source_ids) & set(target_ids):
        raise ValueError("源数据源与目标数据源列表不得有交集")

    wf_raw = _payload_sync_workflow_dict(payload)
    wf_json = _validate_and_dump_sync_workflow(wf_raw) if wf_raw else ""

    if len(source_ids) > 1 and not wf_json:
        raise ValueError("多源同步须配置非空的 sync_workflow，以合并/处理多路 DataFrame")

    return _datasource_sync_run(
        payload, source_ids=source_ids, target_ids=target_ids, wf_json=wf_json
    )


register_task_handler("datasource.sync", datasource_sync_handler)
