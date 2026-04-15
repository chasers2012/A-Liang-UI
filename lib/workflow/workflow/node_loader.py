from __future__ import annotations

import ast
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .node_types import Node


class WorkflowNodeLoader:
    """Extensible loader for resolving workflow node classes from type keys."""

    _instance: WorkflowNodeLoader | None = None

    def __init__(self) -> None:
        self._registered: dict[str, type[Node]] = {}

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

    def resolve(self, type_key: str) -> type[Node]:
        # 1) Explicit registrations from the application.
        cls = self._registered.get(type_key)
        if cls is not None:
            return cls
        raise KeyError(f"未注册的 workflow node type: {type_key!r}")

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
