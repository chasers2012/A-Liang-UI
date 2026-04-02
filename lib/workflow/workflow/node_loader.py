from __future__ import annotations

import ast
import importlib
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .node_types import Node


class WorkflowNodeLoader:
    """Extensible loader for resolving workflow node classes from type keys."""

    _instance: WorkflowNodeLoader | None = None

    def __init__(self) -> None:
        self._registered: dict[str, type[Node]] = {}
        self._cache: dict[str, type[Node]] = {}

    @classmethod
    def instance(cls) -> WorkflowNodeLoader:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_node(
        self,
        type_key: str,
        node_cls: type[Node],
    ) -> None:
        self._registered[type_key] = node_cls
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
        # 1) Explicit registrations from the application.
        cls = self._registered.get(type_key)
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

    @staticmethod
    def load_workflow_node_class_from_source(source: str) -> type[Node]:
        """Load the first ``@workflow_node``-decorated Node class from python source."""
        import workflow as workflow_lib

        tree = ast.parse(source)
        class_names_in_order: list[str] = [n.name for n in tree.body if isinstance(n, ast.ClassDef)]

        module_name = "__workflow_node_source__"
        env: dict[str, object] = {"__name__": module_name}
        exec(compile(tree, filename=module_name, mode="exec"), env, env)

        def _is_workflow_node_class(obj: object) -> bool:
            if not isinstance(obj, type):
                return False
            if not issubclass(obj, workflow_lib.Node):
                return False
            return (
                getattr(obj, "__module__", None) == module_name
                and isinstance(getattr(obj, "label", None), str)
                and isinstance(getattr(obj, "description", None), str)
                and getattr(obj, "inputs", None) is not None
                and getattr(obj, "outputs", None) is not None
            )

        workflow_classes: dict[str, type] = {
            name: obj for name, obj in env.items() if name and _is_workflow_node_class(obj)
        }

        picked: type | None = None
        for name in class_names_in_order:
            candidate = workflow_classes.get(name)
            if candidate is not None:
                picked = candidate
                break
        if picked is None and workflow_classes:
            picked = next(iter(workflow_classes.values()))
        if picked is None:
            raise ValueError("source 中未找到 @workflow_node(...) 装饰的类")
        return picked
