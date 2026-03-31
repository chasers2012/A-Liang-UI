from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path

from workspace import workspace_path

from .package_registry_schemas import WorkflowNodePackageKind, WorkflowNodePackageRecord

WORKFLOW_NODES_RELATIVE_ROOT = "workflow_nodes"
_PACKAGE_RECORDS_BY_ID: dict[str, WorkflowNodePackageRecord] = {}
_DOMAIN_PACKAGE_ORDER: dict[str, list[str]] = {}


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
    pkg_id = f"{key}:{pkg}"
    existing = _PACKAGE_RECORDS_BY_ID.get(pkg_id)
    if existing is not None:
        existing.kind = kind
        existing.enabled = enabled
        return existing

    rec = WorkflowNodePackageRecord(
        id=pkg_id,
        domain=key,
        package_name=pkg,
        kind=kind,
        enabled=enabled,
    )
    _PACKAGE_RECORDS_BY_ID[pkg_id] = rec
    order = _DOMAIN_PACKAGE_ORDER.setdefault(key, [])
    if append:
        order.append(pkg_id)
    else:
        order.insert(0, pkg_id)
    return rec


def list_domain_packages(
    domain: str, *, include_disabled: bool = False
) -> list[WorkflowNodePackageRecord]:
    key = (domain or "").strip()
    if not key:
        return []
    ordered_ids = _DOMAIN_PACKAGE_ORDER.get(key, [])
    items = [
        _PACKAGE_RECORDS_BY_ID[pkg_id] for pkg_id in ordered_ids if pkg_id in _PACKAGE_RECORDS_BY_ID
    ]
    if not include_disabled:
        items = [i for i in items if i.enabled]
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
    items = [i for i in _PACKAGE_RECORDS_BY_ID.values() if i.enabled and i.kind == "builtin"]
    items.sort(key=lambda i: (i.domain, i.package_name))
    for rec in items:
        ensure_package_on_disk(rec)
