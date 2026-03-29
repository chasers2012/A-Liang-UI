"""One-time migration from flat ``config/`` layout to domain-based workspace layout."""

from __future__ import annotations

import json

from workspace import workspace_path

_FILE_MIGRATIONS: list[tuple[str, str]] = [
    ("config/factors.json", "factors/registry.json"),
    ("config/datasources.json", "datasources/registry.json"),
    ("config/data_sets.json", "data_sets/registry.json"),
    ("config/evaluation_data_sets.json", "data_sets/registry.json"),
    ("config/evaluation_test_sets.json", "data_sets/registry.json"),
    ("config/evaluation_metrics.json", "evaluation/metrics/registry.json"),
    ("config/factor_evaluations.json", "factors/data/evaluations.json"),
    ("config/factor_evaluation_history.json", "factors/data/evaluation_history.json"),
    ("config/factor_code_snapshots.json", "factors/data/code_snapshots.json"),
    ("config/agent_llm.json", "agent/llm.json"),
]

_SOURCE_DIR_MIGRATIONS: list[tuple[str, str]] = [
    ("factors", "factors/source"),
    ("evaluation_metrics", "evaluation/metrics/source"),
]

_SOURCE_PATH_REWRITES: list[tuple[str, str, str]] = [
    ("factors/registry.json", "factors/", "factors/source/"),
    ("evaluation/metrics/registry.json", "evaluation_metrics/", "evaluation/metrics/source/"),
]

_LEFTOVERS = [
    "config/agent_workflows.json",
    "config/evaluation_visualization_nodes.json",
    "config/evaluation_profiles.json",
]


def _move_file(old_rel: str, new_rel: str) -> None:
    old = workspace_path(old_rel)
    new = workspace_path(new_rel)
    if old.is_file() and not new.is_file():
        new.parent.mkdir(parents=True, exist_ok=True)
        old.rename(new)


def _move_source_dir(old_rel: str, new_rel: str) -> None:
    """Move *.py files from old source dir into new source dir."""
    old = workspace_path(old_rel)
    if not old.is_dir():
        return
    new = workspace_path(new_rel)
    new.mkdir(parents=True, exist_ok=True)
    for p in old.glob("*.py"):
        dest = new / p.name
        if not dest.is_file():
            p.rename(dest)
        else:
            p.unlink()
    if not any(old.iterdir()):
        old.rmdir()


def _rewrite_source_paths(registry_rel: str, old_prefix: str, new_prefix: str) -> None:
    """Update ``source_path`` fields in a registry JSON file."""
    path = workspace_path(registry_rel)
    if not path.is_file():
        return
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    items = data.get("items", [])
    changed = False
    for item in items:
        sp = item.get("source_path", "")
        if sp.startswith(old_prefix):
            item["source_path"] = new_prefix + sp[len(old_prefix) :]
            changed = True
    if changed:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def _remove_empty_dir(rel: str) -> None:
    d = workspace_path(rel)
    if d.is_dir() and not any(d.iterdir()):
        d.rmdir()


def _delete_leftover(rel: str) -> None:
    p = workspace_path(rel)
    if p.is_file():
        p.unlink()


def migrate_workspace_layout() -> None:
    """Migrate workspace from legacy flat ``config/`` layout to domain-based layout.

    Safe to call on every startup -- skips files that have already been moved.
    """
    config_dir = workspace_path("config")
    if not config_dir.is_dir():
        return

    for old, new in _FILE_MIGRATIONS:
        _move_file(old, new)

    for old, new in _SOURCE_DIR_MIGRATIONS:
        _move_source_dir(old, new)

    for reg, old_pfx, new_pfx in _SOURCE_PATH_REWRITES:
        _rewrite_source_paths(reg, old_pfx, new_pfx)

    for leftover in _LEFTOVERS:
        _delete_leftover(leftover)

    _remove_empty_dir("config/evaluation_profiles")
    _remove_empty_dir("config/agent_workflows")
    _remove_empty_dir("config")
