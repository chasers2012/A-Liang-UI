from __future__ import annotations

from pathlib import Path

from app.factors.code_snapshot_schemas import (
    FactorCodeSnapshot,
    FactorCodeSnapshotKind,
    FactorCodeSnapshotMeta,
    FactorCodeSnapshotsFile,
)
from app.factors.schemas import FactorRecord, new_factor_id, utc_now_iso
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

FACTOR_CODE_SNAPSHOTS_FILENAME = "factor_code_snapshots.json"

MAX_SNAPSHOTS_PER_FACTOR = 100
MAX_SNAPSHOTS_HARD_CAP = 150


def snapshots_file_path() -> Path:
    return workspace_config_path(FACTOR_CODE_SNAPSHOTS_FILENAME)


def load_snapshots_file() -> FactorCodeSnapshotsFile:
    return load_workspace_config(
        FACTOR_CODE_SNAPSHOTS_FILENAME,
        FactorCodeSnapshotsFile,
        default_factory=FactorCodeSnapshotsFile,
        json_error_label="factor_code_snapshots.json",
    )


def save_snapshots_file(data: FactorCodeSnapshotsFile) -> None:
    save_workspace_config(FACTOR_CODE_SNAPSHOTS_FILENAME, data)


def _meta_from_record(rec: FactorRecord) -> FactorCodeSnapshotMeta:
    return FactorCodeSnapshotMeta(
        name=rec.name,
        group=rec.group,
        description=rec.description,
        max_window=rec.max_window,
        dependencies=list(rec.dependencies),
    )


def _oldest_auto_index(snapshots: list[FactorCodeSnapshot]) -> int | None:
    for i, s in enumerate(snapshots):
        if s.kind == "auto":
            return i
    return None


def trim_snapshots(snapshots: list[FactorCodeSnapshot]) -> list[FactorCodeSnapshot]:
    """Oldest-first list; prefer dropping oldest auto until under soft cap, then oldest any."""
    out = list(snapshots)
    while len(out) > MAX_SNAPSHOTS_HARD_CAP:
        i = _oldest_auto_index(out)
        if i is not None:
            del out[i]
        else:
            del out[0]
    while len(out) > MAX_SNAPSHOTS_PER_FACTOR:
        i = _oldest_auto_index(out)
        if i is not None:
            del out[i]
        else:
            del out[0]
    return out


def append_code_snapshot(
    factor_id: str,
    rec: FactorRecord,
    source: str,
    *,
    kind: FactorCodeSnapshotKind,
    label: str | None = None,
) -> FactorCodeSnapshot:
    file = load_snapshots_file()
    lst = list(file.factors.get(factor_id, []))
    snap = FactorCodeSnapshot(
        id=new_factor_id(),
        saved_at=utc_now_iso(),
        kind=kind,
        label=(label or "").strip() or None,
        source=source,
        meta=_meta_from_record(rec),
    )
    lst.append(snap)
    lst = trim_snapshots(lst)
    file.factors[factor_id] = lst
    save_snapshots_file(file)
    return snap


def list_snapshots_for_factor(factor_id: str) -> list[FactorCodeSnapshot]:
    file = load_snapshots_file()
    return list(file.factors.get(factor_id, []))


def get_snapshot(factor_id: str, snapshot_id: str) -> FactorCodeSnapshot | None:
    for s in list_snapshots_for_factor(factor_id):
        if s.id == snapshot_id:
            return s
    return None


def delete_snapshots_for_factor(factor_id: str) -> None:
    file = load_snapshots_file()
    if factor_id not in file.factors:
        return
    del file.factors[factor_id]
    save_snapshots_file(file)
