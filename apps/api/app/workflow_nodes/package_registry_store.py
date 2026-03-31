from __future__ import annotations

from app.persistence.workspace_registry import WorkspaceItemsRegistry

from .package_registry_schemas import (
    WorkflowNodePackageKind,
    WorkflowNodePackageRecord,
    WorkflowNodePackagesRegistryFile,
)

REGISTRY_FILENAME = "workflow_nodes/registry.json"


def workflow_node_package_id(domain: str, package_name: str) -> str:
    return f"{domain}:{package_name}"


class WorkflowNodePackagesRegistry(
    WorkspaceItemsRegistry[WorkflowNodePackageRecord, WorkflowNodePackagesRegistryFile]
):
    filename = REGISTRY_FILENAME
    file_model = WorkflowNodePackagesRegistryFile

    @classmethod
    def upsert_package(
        cls,
        *,
        domain: str,
        package_name: str,
        kind: WorkflowNodePackageKind,
        enabled: bool = True,
    ) -> WorkflowNodePackageRecord:
        pkg_id = workflow_node_package_id(domain, package_name)
        rec = cls.get_item(pkg_id)
        if rec is None:
            rec = WorkflowNodePackageRecord(
                id=pkg_id,
                domain=domain,
                package_name=package_name,
                kind=kind,
                enabled=enabled,
            )
            cls.add_item(rec)
            return rec

        def _apply(item: WorkflowNodePackageRecord) -> None:
            item.kind = kind
            item.enabled = enabled

        updated = cls.update_item(pkg_id, _apply)
        if updated is None:
            raise RuntimeError("workflow node package upsert failed unexpectedly")
        return updated
