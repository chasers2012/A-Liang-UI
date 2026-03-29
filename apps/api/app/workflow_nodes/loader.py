"""Load :class:`~workflow.NodeCatalog` for a domain from built-in packages and workspace."""

from __future__ import annotations

import importlib
import sys

from workflow import NodeCatalog, build_node_catalog_from_modules, merge_node_catalogs
from workspace import workspace_path

WORKFLOW_NODES_RELATIVE_ROOT = "workflow_nodes"

_BUILTIN_TOP_PACKAGE: dict[str, str] = {
    "evaluation": "evaluation_workflow_nodes",
    "agent": "agent_workflow_nodes",
}


def load_workspace_extension_catalogs(domain: str) -> list[NodeCatalog]:
    """Each immediate subdirectory of ``workflow_nodes/<domain>/`` that is a package becomes one catalog."""
    root = workspace_path(WORKFLOW_NODES_RELATIVE_ROOT, domain)
    if not root.is_dir():
        return []
    candidates = sorted(p for p in root.iterdir() if p.is_dir() and (p / "__init__.py").is_file())
    if not candidates:
        return []
    parent = str(root.resolve())
    if parent not in sys.path:
        sys.path.insert(0, parent)
    return [build_node_catalog_from_modules(importlib.import_module(p.name)) for p in candidates]


def load_domain_node_catalog(domain: str) -> NodeCatalog:
    """Built-in package for ``domain`` merged with any workspace packages under ``workflow_nodes/<domain>/``.

    Later sources override earlier on duplicate ``WORKFLOW_TYPE_ID`` (workspace packages win over builtin;
    among workspace packages, lexicographic dir order then later merge wins).
    """
    key = domain.strip()
    pkg = _BUILTIN_TOP_PACKAGE.get(key)
    if pkg is None:
        raise KeyError(f"unknown workflow node domain: {domain!r}")
    builtin_mod = importlib.import_module(pkg)
    builtin_cat = build_node_catalog_from_modules(builtin_mod)
    extras = load_workspace_extension_catalogs(key)
    if not extras:
        return builtin_cat
    return merge_node_catalogs(builtin_cat, *extras)
