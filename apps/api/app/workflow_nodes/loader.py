"""Load :class:`~workflow.NodeCatalog` for a domain from workspace workflow node packages."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

from workflow import NodeCatalog, build_node_catalog_from_modules, merge_node_catalogs
from workspace import workspace_path

from app.workflow_nodes.seed_builtin import (
    BUILTIN_PACKAGE_BY_DOMAIN,
    WORKFLOW_NODES_RELATIVE_ROOT,
    ensure_builtin_workflow_packages,
)


def _domain_root(domain: str) -> Path:
    return workspace_path(WORKFLOW_NODES_RELATIVE_ROOT, domain)


def _ensure_domain_parent_on_sys_path(domain: str) -> None:
    root = _domain_root(domain)
    if not root.is_dir():
        return
    parent = str(root.resolve())
    if parent not in sys.path:
        sys.path.insert(0, parent)


def _package_dirs(domain: str) -> list[Path]:
    root = _domain_root(domain)
    if not root.is_dir():
        return []
    return sorted(p for p in root.iterdir() if p.is_dir() and (p / "__init__.py").is_file())


def _catalog_from_package_dir(domain: str, pkg_dir: Path) -> NodeCatalog:
    _ensure_domain_parent_on_sys_path(domain)
    return build_node_catalog_from_modules(importlib.import_module(pkg_dir.name))


def load_workspace_extension_catalogs(domain: str) -> list[NodeCatalog]:
    """Each immediate subdirectory of ``workflow_nodes/<domain>/`` that is a package becomes one catalog."""
    return [_catalog_from_package_dir(domain, p) for p in _package_dirs(domain)]


def load_domain_node_catalog(domain: str) -> NodeCatalog:
    """Load catalogs only from ``workflow_nodes/<domain>/*`` (seeded built-in dir + user packages).

    Built-in package directory is merged first; remaining directories are merged in sorted order.
    Later merges win on duplicate ``WORKFLOW_TYPE_ID`` (user packages override built-in).
    """
    key = domain.strip()
    builtin_pkg = BUILTIN_PACKAGE_BY_DOMAIN.get(key)
    if builtin_pkg is None:
        raise KeyError(f"unknown workflow node domain: {domain!r}")
    ensure_builtin_workflow_packages(key)
    dirs = _package_dirs(key)
    if not dirs:
        raise RuntimeError(f"no workflow node packages under workflow_nodes/{key!r}")

    builtin_dirs = [p for p in dirs if p.name == builtin_pkg]
    user_dirs = sorted(p for p in dirs if p.name != builtin_pkg)
    ordered = builtin_dirs + user_dirs

    catalogs = [_catalog_from_package_dir(key, p) for p in ordered]
    if len(catalogs) == 1:
        return catalogs[0]
    return merge_node_catalogs(*catalogs)
