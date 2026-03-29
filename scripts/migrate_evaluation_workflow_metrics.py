#!/usr/bin/env python3
"""Migrate workspace after evaluation metric workflow redesign.

- Profile ``workflow.nodes[].type``: ``metric:builtin.*`` → ``builtin_mean_*``;
  ``metric:<uuid>`` → ``user_metric_<uuid_underscored>``.
- ``registry.json``: drop built-in metric rows; add/update user rows with
  ``workflow_type_id`` and ``workflow_nodes/evaluation/em_*/metric_node.py``.
- User metric Python: move from ``evaluation/metrics/source/<uuid>.py`` into a
  workspace package and append a ``@workflow_node`` shell if missing.

Usage::

    uv run python scripts/migrate_evaluation_workflow_metrics.py [WORKSPACE_ROOT]

Or set ``QUANT_AGENT_WORKSPACE`` and omit the argument.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

BUILTIN_IDS = frozenset({"builtin.mean_ic", "builtin.mean_return_spread"})
BUILTIN_SOURCE_NAMES = frozenset({"builtin.mean_ic.py", "builtin.mean_return_spread.py"})
TYPE_MAP = {
    "metric:builtin.mean_ic": "builtin_mean_ic",
    "metric:builtin.mean_return_spread": "builtin_mean_return_spread",
}
METRIC_PREFIX = "metric:"

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


def _slug(metric_id: str) -> str:
    return metric_id.replace("-", "_")


def _workflow_type_user(metric_id: str) -> str:
    return f"user_metric_{_slug(metric_id)}"


def _pkg_dir(metric_id: str) -> str:
    return f"em_{_slug(metric_id)}"


def _new_source_rel(metric_id: str) -> str:
    return f"workflow_nodes/evaluation/{_pkg_dir(metric_id)}/metric_node.py"


def _normalize_metric_node_type(t: str) -> str | None:
    if t in TYPE_MAP:
        return TYPE_MAP[t]
    if not t.startswith(METRIC_PREFIX):
        return None
    rest = t[len(METRIC_PREFIX) :].strip()
    if _UUID_RE.match(rest):
        return _workflow_type_user(rest)
    return None


def _migrate_profiles(profiles_dir: Path) -> int:  # noqa: C901
    changed = 0
    if not profiles_dir.is_dir():
        return 0
    for path in sorted(profiles_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        wf = data.get("workflow")
        if not isinstance(wf, dict):
            continue
        nodes = wf.get("nodes")
        if not isinstance(nodes, list):
            continue
        file_changed = False
        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get("type")
            if not isinstance(t, str):
                continue
            new_t = _normalize_metric_node_type(t)
            if new_t is not None:
                node["type"] = new_t
                file_changed = True
        if file_changed:
            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            changed += 1
    return changed


def _workflow_shell(metric_id: str, workflow_type_id: str, label: str) -> str:
    label_esc = json.dumps(label, ensure_ascii=False)
    return f"""

# --- workflow binding (added by migrate_evaluation_workflow_metrics.py) ---
from __future__ import annotations

from typing import Any

import pandas as pd
from app.evaluation.metrics.user_metric_workflow import RegistryUserEvaluationMetric
from workflow import workflow_node, workflow_socket

REGISTRY_METRIC_ID = "{metric_id}"


@workflow_node(
    type_id="{workflow_type_id}",
    label={label_esc},
    description="",
    entry="evaluate",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
)
class _MigratedUserEvaluationMetric(RegistryUserEvaluationMetric):
    REGISTRY_METRIC_ID = REGISTRY_METRIC_ID

    def evaluate(self, clean_factor: pd.DataFrame, **kwargs: Any) -> dict[str, float]:
        _ = clean_factor
        return {{"demo": 0.0}}
"""


def _write_user_package(root: Path, metric_id: str, source_body: str, label: str) -> None:
    wf_tid = _workflow_type_user(metric_id)
    if (
        "RegistryUserEvaluationMetric" not in source_body
        and "run_registry_evaluation_metric" not in source_body
        and "UserMetricWorkflowNode" not in source_body
        and "_MigratedUserMetricWorkflowNode" not in source_body
    ):
        source_body = source_body.rstrip() + _workflow_shell(metric_id, wf_tid, label)
    pkg = root / "workflow_nodes" / "evaluation" / _pkg_dir(metric_id)
    pkg.mkdir(parents=True, exist_ok=True)
    (pkg / "__init__.py").write_text(
        "# User evaluation metric package\nfrom . import metric_node  # noqa: F401\n",
        encoding="utf-8",
    )
    (pkg / "metric_node.py").write_text(source_body.rstrip() + "\n", encoding="utf-8")


def _remove_builtin_source_files(root: Path) -> int:
    src_dir = root / "evaluation" / "metrics" / "source"
    if not src_dir.is_dir():
        return 0
    n = 0
    for name in BUILTIN_SOURCE_NAMES:
        p = src_dir / name
        if p.is_file():
            p.unlink()
            n += 1
    return n


def _migrate_user_metrics(root: Path) -> tuple[bool, int]:  # noqa: C901
    registry_path = root / "evaluation" / "metrics" / "registry.json"
    if not registry_path.is_file():
        return False, 0
    try:
        data = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False, 0
    items = data.get("items")
    if not isinstance(items, list):
        return False, 0

    items = [x for x in items if isinstance(x, dict) and x.get("id") not in BUILTIN_IDS]

    by_id = {str(x["id"]): x for x in items if x.get("id")}

    legacy_dir = root / "evaluation" / "metrics" / "source"
    if legacy_dir.is_dir():
        for path in sorted(legacy_dir.glob("*.py")):
            stem = path.stem
            if stem in BUILTIN_IDS or not _UUID_RE.match(stem):
                continue
            if stem not in by_id:
                now = _utc_now_iso()
                by_id[stem] = {
                    "id": stem,
                    "name": f"metric-{stem[:8]}",
                    "description": "",
                    "source_path": _new_source_rel(stem),
                    "workflow_type_id": _workflow_type_user(stem),
                    "created_at": now,
                    "updated_at": now,
                    "visualization": None,
                    "builtin": False,
                    "workflow_parameters": [],
                }
                items.append(by_id[stem])

    packages_written = 0
    for rec in items:
        mid = str(rec.get("id") or "")
        if mid in BUILTIN_IDS or not _UUID_RE.match(mid):
            continue
        label = str(rec.get("name") or f"metric-{mid[:8]}")
        wf_tid = _workflow_type_user(mid)
        new_rel = _new_source_rel(mid)
        old_rel = rec.get("source_path") if isinstance(rec.get("source_path"), str) else ""
        legacy_path = legacy_dir / f"{mid}.py" if legacy_dir.is_dir() else None
        body = ""
        if legacy_path and legacy_path.is_file():
            body = legacy_path.read_text(encoding="utf-8")
        elif old_rel:
            old_abs = root / old_rel
            if old_abs.is_file():
                body = old_abs.read_text(encoding="utf-8")
        if not body.strip():
            candidate = root / new_rel
            if candidate.is_file():
                body = candidate.read_text(encoding="utf-8")
        if not body.strip():
            continue
        _write_user_package(root, mid, body, label)
        rec["source_path"] = new_rel
        rec["workflow_type_id"] = wf_tid
        rec["updated_at"] = _utc_now_iso()
        packages_written += 1
        if legacy_path and legacy_path.is_file():
            legacy_path.unlink()

    data["items"] = items
    registry_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return True, packages_written


def main() -> None:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
    if root is None:
        env = __import__("os").environ.get("QUANT_AGENT_WORKSPACE")
        if not env:
            print("Set QUANT_AGENT_WORKSPACE or pass workspace root as argv[1]", file=sys.stderr)
            sys.exit(1)
        root = Path(env).expanduser().resolve()

    pc = _migrate_profiles(root / "evaluation" / "profiles")
    reg_ok, pkgs = _migrate_user_metrics(root)
    removed = _remove_builtin_source_files(root)
    print(
        f"profiles_updated={pc}; registry_and_packages_ok={reg_ok}; "
        f"user_packages_written={pkgs}; builtin_source_files_removed={removed}"
    )


if __name__ == "__main__":
    main()
