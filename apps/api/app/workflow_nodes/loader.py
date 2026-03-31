"""Load merged workflow node registry from all workspace workflow node segments."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import ClassVar

from workflow import Node, NodeRegistry, build_node_registry_from_modules, merge_node_registries
from workspace import workspace_path

from app.workflow_nodes.seed_builtin import (
    builtin_package_for_domain,
    ensure_builtin_workflow_packages,
)

from .package_manager import WORKFLOW_NODES_RELATIVE_ROOT, list_domain_packages


class WorkflowNodeLoader:
    """Workspace workflow node loader/registry utilities (class-only API)."""

    # Workspace workflow node "segments" (domains) are registered here.
    # Merge order matters: later segments override earlier on duplicate node type keys.
    _segments: ClassVar[list[str]] = []

    # --- segment registration -------------------------------------------------
    @classmethod
    def register_workflow_node_segment(cls, segment: str, *, append: bool = True) -> None:
        """
        Register a workflow node segment (domain) to be loaded from the workspace.

        Args:
            segment: domain name under ``workflow_nodes/<segment>/``.
            append: when True (default), add to the end (higher precedence).
                    when False, add to the front (lower precedence).
        """
        seg = (segment or "").strip()
        if not seg:
            raise ValueError("segment 不能为空")
        if seg in cls._segments:
            return
        if append:
            cls._segments.append(seg)
        else:
            cls._segments.insert(0, seg)

    @classmethod
    def registered_workflow_node_segments(cls) -> tuple[str, ...]:
        """Return current registered segment order (immutable view)."""
        return tuple(cls._segments)

    # --- internal helpers -----------------------------------------------------
    @staticmethod
    def _segment_root(segment: str) -> Path:
        return workspace_path(WORKFLOW_NODES_RELATIVE_ROOT, segment)

    @classmethod
    def _ensure_segment_parent_on_sys_path(cls, segment: str) -> None:
        root = cls._segment_root(segment)
        if not root.is_dir():
            return
        parent = str(root.resolve())
        if parent not in sys.path:
            sys.path.insert(0, parent)

    @classmethod
    def _package_dirs(cls, segment: str) -> list[Path]:
        root = cls._segment_root(segment)
        if not root.is_dir():
            return []
        return sorted(p for p in root.iterdir() if p.is_dir() and (p / "__init__.py").is_file())

    @classmethod
    def _registry_from_package_dir(cls, segment: str, pkg_dir: Path) -> NodeRegistry:
        cls._ensure_segment_parent_on_sys_path(segment)
        reg = build_node_registry_from_modules(importlib.import_module(pkg_dir.name))
        # Ensure node.category is usable for domain filtering:
        # - If a node explicitly sets category in @workflow_node, keep it.
        # - Otherwise default to the segment name (e.g. "evaluation" / "agent").
        for rn in reg.values():
            d = rn.definition
            if not (getattr(d, "category", "") or "").strip():
                d.category = segment  # type: ignore[assignment]
        return reg

    @classmethod
    def _ordered_package_dirs(cls, segment: str) -> list[Path]:
        ensure_builtin_workflow_packages(segment)
        dirs_by_name = {p.name: p for p in cls._package_dirs(segment)}
        ordered = []
        records = list_domain_packages(segment)
        for rec in records:
            pkg_dir = dirs_by_name.get(rec.package_name)
            if pkg_dir is not None:
                ordered.append(pkg_dir)
        if ordered:
            return ordered
        dirs = cls._package_dirs(segment)
        if not dirs:
            raise RuntimeError(f"no workflow node packages under workflow_nodes/{segment!r}")
        # "无先后顺序": 不对 builtin/user 做强制优先级；用名字排序获得确定性。
        return sorted(dirs, key=lambda p: p.name)

    @classmethod
    def load_workspace_extension_registries(cls) -> list[NodeRegistry]:
        """One registry per user (non-builtin) package under any ``workflow_nodes/<segment>/``."""
        out: list[NodeRegistry] = []
        for seg in cls.registered_workflow_node_segments():
            builtin_names = {
                i.package_name for i in list_domain_packages(seg) if i.kind == "builtin"
            }
            if not builtin_names:
                builtin_names = {builtin_package_for_domain(seg)}
            try:
                ordered = cls._ordered_package_dirs(seg)
            except RuntimeError:
                continue
            for p in ordered:
                if p.name in builtin_names:
                    continue
                out.append(cls._registry_from_package_dir(seg, p))
        return out

    @classmethod
    def _load_segment_registry(cls, segment: str) -> NodeRegistry:
        ordered = cls._ordered_package_dirs(segment)
        registries = [cls._registry_from_package_dir(segment, p) for p in ordered]
        if len(registries) == 1:
            return registries[0]
        return merge_node_registries(*registries)

    @classmethod
    def load_workspace_node_registry(cls) -> NodeRegistry:
        """Load and merge all workflow node packages from every configured workspace segment.

        Segments are merged in registration order.
        Later segments override earlier on duplicate node type keys.
        """
        merged: list[NodeRegistry] = []
        for seg in cls.registered_workflow_node_segments():
            merged.append(cls._load_segment_registry(seg))
        if len(merged) == 1:
            return merged[0]
        return merge_node_registries(*merged)

    @classmethod
    def list_nodes(
        cls,
        categories: list[str] | None = None,
        types: list[str] | None = None,
    ) -> list[Node]:
        """
        List workspace workflow node type definitions.

        Args:
            categories: optional list of Node.category to include.
            types: optional list of Node.type keys (i.e. ``module.qualname``) to include.

        Returns:
            Ordered list of workflow.Node definitions (type metadata), not the Python classes.
        """
        reg = cls.load_workspace_node_registry()

        cat_set: set[str] | None = None
        if categories is not None:
            cat_set = {str(c).strip() for c in categories if c is not None and str(c).strip()}

        type_set: set[str] | None = None
        if types is not None:
            type_set = {str(t).strip() for t in types if t is not None and str(t).strip()}

        out: list[Node] = []
        for rn in reg.values():
            d = rn.definition
            if type_set is not None and d.type not in type_set:
                continue
            if cat_set is not None and d.category not in cat_set:
                continue
            out.append(d)

        # Stable output for frontend grouping.
        out.sort(key=lambda d: (d.category or "", d.label or "", d.type or ""))
        return out
