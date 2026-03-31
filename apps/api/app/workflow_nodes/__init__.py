"""Workspace-scoped workflow node packages (unified registry across segments)."""

from .package_manager import register_workflow_node_package
from .seed_builtin import (
    builtin_package_for_domain,
    ensure_all_builtin_workflow_domains,
    ensure_builtin_workflow_packages,
    register_builtin_workflow_domain,
    registered_builtin_workflow_domains,
)

__all__ = [
    "WorkflowNodeLoader",
    "builtin_package_for_domain",
    "ensure_all_builtin_workflow_domains",
    "ensure_builtin_workflow_packages",
    "register_builtin_workflow_domain",
    "register_workflow_node_package",
    "registered_builtin_workflow_domains",
]


def __getattr__(name: str) -> object:
    if name == "WorkflowNodeLoader":
        from .loader import WorkflowNodeLoader

        return WorkflowNodeLoader
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
