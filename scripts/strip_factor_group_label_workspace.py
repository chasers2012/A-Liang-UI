#!/usr/bin/env python3
"""
One-off migration: remove legacy ``group_label`` from workspace data.

- Strips ``group_label`` from each entry in ``config/factors.json``.
- Removes ``group_label = ...`` lines from ``factors/*.py`` under the workspace.

Usage::

    python scripts/strip_factor_group_label_workspace.py
    python scripts/strip_factor_group_label_workspace.py /path/to/quant-agent-workspace

Default workspace: ``QUANT_AGENT_WORKSPACE`` if set, else ``~/.quant-agent``.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

_GROUP_LABEL_LINE = re.compile(r"^[ \t]*group_label\s*=.*(?:\r?\n|\Z)", re.MULTILINE)


def _workspace_root(argv: list[str]) -> Path:
    if len(argv) >= 2:
        return Path(argv[1]).expanduser().resolve()
    env = os.environ.get("QUANT_AGENT_WORKSPACE", "").strip()
    if env:
        return Path(env).expanduser().resolve()
    return Path.home() / ".quant-agent"


def strip_factors_json(config_dir: Path) -> bool:
    path = config_dir / "factors.json"
    if not path.is_file():
        return False
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items")
    if not isinstance(items, list):
        return False
    changed = False
    for it in items:
        if isinstance(it, dict) and "group_label" in it:
            del it["group_label"]
            changed = True
    if changed:
        text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        path.write_text(text, encoding="utf-8")
    return changed


def strip_factor_py_files(factors_dir: Path) -> tuple[int, int]:
    """Returns (files_changed, total_py_files)."""
    if not factors_dir.is_dir():
        return 0, 0
    py_files = sorted(factors_dir.glob("*.py"))
    n_changed = 0
    for p in py_files:
        raw = p.read_text(encoding="utf-8")
        cleaned = _GROUP_LABEL_LINE.sub("", raw)
        if cleaned != raw:
            p.write_text(cleaned, encoding="utf-8")
            n_changed += 1
    return n_changed, len(py_files)


def main() -> int:
    root = _workspace_root(sys.argv)
    config_dir = root / "config"
    factors_dir = root / "factors"

    if not root.is_dir():
        print(f"Workspace not found: {root}", file=sys.stderr)
        return 1

    reg_ok = strip_factors_json(config_dir)
    py_changed, py_total = strip_factor_py_files(factors_dir)

    print(f"Workspace: {root}")
    print(
        f"  config/factors.json: {'updated (removed group_label keys)' if reg_ok else 'unchanged or missing'}"
    )
    print(f"  factors/*.py: {py_changed}/{py_total} file(s) stripped group_label lines")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
