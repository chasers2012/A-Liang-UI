"""Load merged workflow node registry from all workspace workflow node segments."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

from workflow import NodeRegistry, build_node_registry_from_modules, merge_node_registries
from workspace import workspace_path

from app.workflow_nodes.seed_builtin import (
    BUILTIN_PACKAGE_BY_DOMAIN,
    WORKFLOW_NODES_RELATIVE_ROOT,
    ensure_builtin_workflow_packages,
)

# Fixed merge order: evaluation segment before agent (later merge wins on duplicate keys).
WORKFLOW_NODE_SEGMENTS: tuple[str, ...] = ("evaluation", "agent")


def _segment_root(segment: str) -> Path:
    return workspace_path(WORKFLOW_NODES_RELATIVE_ROOT, segment)


def _ensure_segment_parent_on_sys_path(segment: str) -> None:
    root = _segment_root(segment)
    if not root.is_dir():
        return
    parent = str(root.resolve())
    if parent not in sys.path:
        sys.path.insert(0, parent)


def _package_dirs(segment: str) -> list[Path]:
    root = _segment_root(segment)
    if not root.is_dir():
        return []
    return sorted(p for p in root.iterdir() if p.is_dir() and (p / "__init__.py").is_file())


def _registry_from_package_dir(segment: str, pkg_dir: Path) -> NodeRegistry:
    _ensure_segment_parent_on_sys_path(segment)
    return build_node_registry_from_modules(importlib.import_module(pkg_dir.name))


def _ordered_package_dirs(segment: str) -> list[Path]:
    builtin_pkg = BUILTIN_PACKAGE_BY_DOMAIN.get(segment)
    if builtin_pkg is None:
        raise KeyError(f"unknown workflow node segment: {segment!r}")
    ensure_builtin_workflow_packages(segment)
    dirs = _package_dirs(segment)
    if not dirs:
        raise RuntimeError(f"no workflow node packages under workflow_nodes/{segment!r}")
    builtin_dirs = [p for p in dirs if p.name == builtin_pkg]
    user_dirs = sorted(p for p in dirs if p.name != builtin_pkg)
    return builtin_dirs + user_dirs


def load_workspace_extension_registries() -> list[NodeRegistry]:
    """One registry per user (non-builtin) package under any ``workflow_nodes/<segment>/``."""
    out: list[NodeRegistry] = []
    for seg in WORKFLOW_NODE_SEGMENTS:
        builtin_pkg = BUILTIN_PACKAGE_BY_DOMAIN[seg]
        try:
            ordered = _ordered_package_dirs(seg)
        except RuntimeError:
            continue
        for p in ordered:
            if p.name == builtin_pkg:
                continue
            out.append(_registry_from_package_dir(seg, p))
    return out


def _load_segment_registry(segment: str) -> NodeRegistry:
    ordered = _ordered_package_dirs(segment)
    registries = [_registry_from_package_dir(segment, p) for p in ordered]
    if len(registries) == 1:
        return registries[0]
    return merge_node_registries(*registries)


def load_workspace_node_registry() -> NodeRegistry:
    """Load and merge all workflow node packages from every configured workspace segment.

    Segments are merged in :data:`WORKFLOW_NODE_SEGMENTS` order (evaluation, then agent).
    Later segments override earlier on duplicate node type keys.
    """
    merged: list[NodeRegistry] = []
    for seg in WORKFLOW_NODE_SEGMENTS:
        merged.append(_load_segment_registry(seg))
    if len(merged) == 1:
        return merged[0]
    return merge_node_registries(*merged)
