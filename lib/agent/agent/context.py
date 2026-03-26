"""Runtime context: DependencyResolver for the factor agent."""

from __future__ import annotations

from typing import List, Optional

from factor.dependency_resolver import DependencyResolver

_default_resolver: Optional[DependencyResolver] = None


def set_dependency_resolver(resolver: Optional[DependencyResolver]) -> None:
    """Set the global resolver used for dry-run and Alphalens (None clears)."""
    global _default_resolver
    _default_resolver = resolver


def get_dependency_resolver() -> Optional[DependencyResolver]:
    return _default_resolver


def list_registered_dependency_fields() -> List[str]:
    """Field names registered on the current :class:`DependencyResolver`, sorted."""
    if _default_resolver is None:
        return []
    return _default_resolver.list_registered_fields()
