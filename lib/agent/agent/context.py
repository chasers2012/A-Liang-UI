"""Runtime context: DependencyResolver for the factor agent."""

from __future__ import annotations

from factor.dependency_resolver import DependencyResolver

__all__ = [
    "get_dependency_resolver",
    "list_registered_dependency_fields",
    "set_dependency_resolver",
]

_default_resolver: DependencyResolver | None = None


def set_dependency_resolver(resolver: DependencyResolver | None) -> None:
    """Set the global resolver used for dry-run and Alphalens (None clears)."""
    global _default_resolver
    _default_resolver = resolver


def get_dependency_resolver() -> DependencyResolver | None:
    return _default_resolver


def list_registered_dependency_fields() -> list[str]:
    """Field names registered on the current :class:`DependencyResolver`, sorted."""
    if _default_resolver is None:
        return []
    return _default_resolver.list_registered_fields()
