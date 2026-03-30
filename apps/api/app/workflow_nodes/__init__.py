"""Workspace-scoped workflow node packages (unified registry across segments)."""

from .loader import load_workspace_extension_registries, load_workspace_node_registry

__all__ = ["load_workspace_extension_registries", "load_workspace_node_registry"]
