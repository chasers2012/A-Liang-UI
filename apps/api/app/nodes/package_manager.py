from __future__ import annotations

import shutil
from collections.abc import Callable

from custom_code import SourceFiles
from workspace import workspace_path

from app.nodes.constants import USER_NODE_WORKFLOW_ROOT


class WorkflowNodePackageManager:
    @staticmethod
    def get_package_dir(node_id: str) -> str:
        return f"n_{node_id.replace('-', '_')}"

    @staticmethod
    def get_source_path(node_id: str) -> str:
        return (
            f"{USER_NODE_WORKFLOW_ROOT}/"
            f"{WorkflowNodePackageManager.get_package_dir(node_id)}/node.py"
        )

    @staticmethod
    def write_node_package(
        node_id: str,
        source: str,
        *,
        validators: list[Callable[[str], None]] | None = None,
    ) -> None:
        pkg_dir = WorkflowNodePackageManager.get_package_dir(node_id)
        source_path = WorkflowNodePackageManager.get_source_path(node_id)

        pkg_root = workspace_path("workflow_nodes", "user", pkg_dir)
        pkg_root.mkdir(parents=True, exist_ok=True)
        SourceFiles.write_source_text(source_path, source, validators=validators)

    @staticmethod
    def delete_node_package(node_id: str) -> None:
        pkg_dir = WorkflowNodePackageManager.get_package_dir(node_id)
        pkg_root = workspace_path("workflow_nodes", "user", pkg_dir)
        if pkg_root.is_dir():
            shutil.rmtree(pkg_root, ignore_errors=True)
