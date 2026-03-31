"""Copy installed workflow node packages into the workspace once (seed-on-miss)."""

from __future__ import annotations

from .package_manager import (
    ensure_all_builtin_seeded,
    ensure_builtin_domain_seeded,
    list_domain_packages,
    register_workflow_node_package,
)

BUILTIN_PACKAGE_BY_DOMAIN: dict[str, str] = {}


def register_builtin_workflow_domain(domain: str, package_name: str) -> None:
    key = (domain or "").strip()
    pkg = (package_name or "").strip()
    if not key:
        raise ValueError("domain 不能为空")
    if not pkg:
        raise ValueError("package_name 不能为空")
    existing = BUILTIN_PACKAGE_BY_DOMAIN.get(key)
    if existing is None:
        BUILTIN_PACKAGE_BY_DOMAIN[key] = pkg
        register_workflow_node_package(key, pkg, kind="builtin", append=True)
        return
    if existing != pkg:
        raise ValueError(
            f"workflow node domain {key!r} already registered with package {existing!r}"
        )
    register_workflow_node_package(key, pkg, kind="builtin", append=True)


def registered_builtin_workflow_domains() -> tuple[str, ...]:
    return tuple(sorted(BUILTIN_PACKAGE_BY_DOMAIN.keys()))


def builtin_package_for_domain(domain: str) -> str:
    key = (domain or "").strip()
    pkg = BUILTIN_PACKAGE_BY_DOMAIN.get(key)
    if pkg is not None:
        return pkg
    builtins = [i for i in list_domain_packages(key) if i.kind == "builtin"]
    if not builtins:
        raise KeyError(f"unknown workflow node domain: {domain!r}")
    builtins.sort(key=lambda i: i.package_name)
    pkg = builtins[0].package_name
    BUILTIN_PACKAGE_BY_DOMAIN[key] = pkg
    return pkg


def ensure_builtin_workflow_packages(domain: str) -> None:
    """If ``workflow_nodes/<domain>/<builtin_pkg>/`` is missing, copy from the installed distribution."""
    key = domain.strip()
    pkg = builtin_package_for_domain(key)
    register_workflow_node_package(key, pkg, kind="builtin", append=True)
    ensure_builtin_domain_seeded(key)


def ensure_all_builtin_workflow_domains() -> None:
    for d in registered_builtin_workflow_domains():
        ensure_builtin_workflow_packages(d)
    ensure_all_builtin_seeded()
