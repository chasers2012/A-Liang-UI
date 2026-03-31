from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path

from workspace import workspace_path

from .package_registry_schemas import WorkflowNodePackageKind, WorkflowNodePackageRecord
from .package_registry_store import WorkflowNodePackagesRegistry

WORKFLOW_NODES_RELATIVE_ROOT = "workflow_nodes"


def _installed_package_root(package_name: str) -> Path:
    spec = importlib.util.find_spec(package_name)
    if spec is None or not spec.submodule_search_locations:
        raise RuntimeError(f"cannot locate installed package {package_name!r}")
    loc = spec.submodule_search_locations[0]
    return Path(loc)


def _package_path(domain: str, package_name: str) -> Path:
    return workspace_path(WORKFLOW_NODES_RELATIVE_ROOT, domain, package_name)


def register_workflow_node_package(
    domain: str,
    package_name: str,
    *,
    kind: WorkflowNodePackageKind,
    append: bool = True,
    enabled: bool = True,
) -> WorkflowNodePackageRecord:
    key = (domain or "").strip()
    pkg = (package_name or "").strip()
    if not key:
        raise ValueError("domain 不能为空")
    if not pkg:
        raise ValueError("package_name 不能为空")
    existing = WorkflowNodePackagesRegistry.get_item(f"{key}:{pkg}")
    # Builtin packages are registered as part of application bootstrap.
    # Avoid repeating upserts (and unnecessary registry writes) when the workspace
    # registry + builtin record already exist.
    if existing is not None:
        if kind == "builtin" and WorkflowNodePackagesRegistry.path().is_file():
            return existing
        if existing.kind == kind and existing.enabled == enabled:
            return existing
        return WorkflowNodePackagesRegistry.upsert_package(
            domain=key,
            package_name=pkg,
            kind=kind,
            enabled=enabled,
        )
    return WorkflowNodePackagesRegistry.upsert_package(
        domain=key,
        package_name=pkg,
        kind=kind,
        enabled=enabled,
    )


def list_domain_packages(
    domain: str, *, include_disabled: bool = False
) -> list[WorkflowNodePackageRecord]:
    key = (domain or "").strip()
    if not key:
        return []
    items = [i for i in WorkflowNodePackagesRegistry.list_items() if i.domain == key]
    if not include_disabled:
        items = [i for i in items if i.enabled]
    # Do not impose builtin/user priority or registry "order" precedence.
    # Deterministic output for tests and stable runtime behavior.
    items.sort(key=lambda i: i.package_name)
    return items


def ensure_package_on_disk(rec: WorkflowNodePackageRecord) -> Path:
    dest = _package_path(rec.domain, rec.package_name)
    if rec.kind == "builtin":
        if dest.is_dir() and (dest / "__init__.py").is_file():
            return dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        src = _installed_package_root(rec.package_name)
        shutil.copytree(src, dest, dirs_exist_ok=True)
        return dest
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def ensure_builtin_domain_seeded(domain: str) -> list[Path]:
    out: list[Path] = []
    for rec in list_domain_packages(domain):
        if rec.kind != "builtin":
            continue
        out.append(ensure_package_on_disk(rec))
    return out


def ensure_all_builtin_seeded() -> None:
    items = [
        i for i in WorkflowNodePackagesRegistry.list_items() if i.enabled and i.kind == "builtin"
    ]
    items.sort(key=lambda i: (i.domain, i.package_name))
    for rec in items:
        ensure_package_on_disk(rec)


def migrate_registry_if_missing(*, builtin_packages: dict[str, str]) -> None:
    if WorkflowNodePackagesRegistry.path().is_file():
        return
    for domain, pkg in builtin_packages.items():
        register_workflow_node_package(domain, pkg, kind="builtin", append=True)
    root = workspace_path(WORKFLOW_NODES_RELATIVE_ROOT)
    if not root.is_dir():
        return
    for domain_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        domain = domain_dir.name
        for pkg_dir in sorted(
            p for p in domain_dir.iterdir() if p.is_dir() and (p / "__init__.py").is_file()
        ):
            if domain in builtin_packages and pkg_dir.name == builtin_packages[domain]:
                continue
            register_workflow_node_package(domain, pkg_dir.name, kind="user", append=True)
