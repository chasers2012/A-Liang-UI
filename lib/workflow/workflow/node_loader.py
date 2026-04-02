from __future__ import annotations

import importlib
from collections.abc import Callable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .node_types import Node


class WorkflowNodeLoader:
    """Extensible loader for resolving workflow node classes from type keys."""

    _instance: WorkflowNodeLoader | None = None

    def __init__(self) -> None:
        self._resolvers: list[Callable[[str], type[Node] | None]] = []
        self._cache: dict[str, type[Node]] = {}

    @classmethod
    def instance(cls) -> WorkflowNodeLoader:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_resolver(
        self,
        resolver: Callable[[str], type[Node] | None],
        *,
        prepend: bool = False,
    ) -> None:
        if prepend:
            self._resolvers.insert(0, resolver)
        else:
            self._resolvers.append(resolver)
        self._cache.clear()

    def resolve(self, type_key: str) -> type[Node]:
        cached = self._cache.get(type_key)
        if cached is not None:
            return cached
        resolved = self._resolve(type_key)
        # Avoid unbounded growth while still caching hot entries.
        if len(self._cache) >= 1024:
            self._cache.pop(next(iter(self._cache)))
        self._cache[type_key] = resolved
        return resolved

    def _resolve(self, type_key: str) -> type[Node]:
        # 1) Domain resolvers registered by the application.
        for resolver in self._resolvers:
            cls = resolver(type_key)
            if cls is not None:
                return cls

        # 2) Default: importable ``module.qualname.Class`` string.
        if "." not in type_key:
            raise ValueError(f"unknown workflow node type {type_key!r}")

        parts = [p for p in type_key.split(".") if p]
        if len(parts) < 2:
            raise ValueError(f"invalid workflow node type: {type_key!r}")

        last_err: Exception | None = None
        # Split from the right: module candidates first, then qualname attributes.
        for i in range(len(parts) - 1, 0, -1):
            module_name = ".".join(parts[:i])
            qual_parts = parts[i:]
            try:
                module = importlib.import_module(module_name)
            except Exception as e:
                last_err = e
                continue

            obj = self._walk_qual_parts(module, qual_parts)
            if obj is None:
                continue
            if isinstance(obj, type):
                return obj

        raise ValueError(
            f"unknown workflow node type {type_key!r}"
            + (f" (last error: {last_err!r})" if last_err else "")
        )

    @staticmethod
    def _walk_qual_parts(obj: object, qual_parts: list[str]) -> object | None:
        """Walk a dotted attribute chain, returning ``None`` if any part is missing."""
        for qp in qual_parts:
            if not hasattr(obj, qp):
                return None
            obj = getattr(obj, qp)
        return obj
