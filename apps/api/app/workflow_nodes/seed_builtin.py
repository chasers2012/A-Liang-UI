"""Copy installed workflow node packages into the workspace once (seed-on-miss)."""

from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path

from workspace import workspace_path

WORKFLOW_NODES_RELATIVE_ROOT = "workflow_nodes"

BUILTIN_PACKAGE_BY_DOMAIN: dict[str, str] = {
    "evaluation": "evaluation_workflow_nodes",
    "agent": "agent_workflow_nodes",
}


def _installed_package_root(package_name: str) -> Path:
    spec = importlib.util.find_spec(package_name)
    if spec is None or not spec.submodule_search_locations:
        raise RuntimeError(f"cannot locate installed package {package_name!r}")
    loc = spec.submodule_search_locations[0]
    return Path(loc)


def _needs_seed(dest: Path) -> bool:
    return not dest.is_dir() or not (dest / "__init__.py").is_file()


def ensure_builtin_workflow_packages(domain: str) -> None:
    """If ``workflow_nodes/<domain>/<builtin_pkg>/`` is missing, copy from the installed distribution."""
    key = domain.strip()
    pkg = BUILTIN_PACKAGE_BY_DOMAIN.get(key)
    if pkg is None:
        raise KeyError(f"unknown workflow node domain: {domain!r}")
    dest = workspace_path(WORKFLOW_NODES_RELATIVE_ROOT, key, pkg)
    if not _needs_seed(dest):
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = _installed_package_root(pkg)
    shutil.copytree(src, dest)


def ensure_all_builtin_workflow_domains() -> None:
    for d in BUILTIN_PACKAGE_BY_DOMAIN:
        ensure_builtin_workflow_packages(d)
