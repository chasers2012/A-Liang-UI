from __future__ import annotations

import ast
import functools
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .node_types import Node


class WorkflowNodeLoader:
    """Resolve workflow node classes from type keys.

    Type keys are expected to be ``module.qualname`` (see :func:`workflow_node_type_key`).
    """

    @staticmethod
    def _walk_qual_parts(obj: object, qual_parts: list[str]) -> object | None:
        """Walk a dotted attribute chain, returning ``None`` if any part is missing."""
        for qp in qual_parts:
            if not hasattr(obj, qp):
                return None
            obj = getattr(obj, qp)
        return obj

    @staticmethod
    @functools.lru_cache(maxsize=2048)
    def resolve(type_key: str) -> type[Node]:
        """Resolve *type_key* (``module.qualname``) into a Node class via import."""
        import importlib

        import workflow as workflow_lib

        tk = (type_key or "").strip()
        if not tk:
            raise KeyError("workflow node type_key 不能为空")

        parts = tk.split(".")
        # Try longest importable module prefix, then walk remaining qual parts.
        for i in range(len(parts), 0, -1):
            mod_name = ".".join(parts[:i])
            try:
                mod = importlib.import_module(mod_name)
            except Exception:
                continue
            qual_parts = parts[i:]
            obj = WorkflowNodeLoader._walk_qual_parts(mod, qual_parts) if qual_parts else mod
            if isinstance(obj, type) and issubclass(obj, workflow_lib.Node):
                return obj

        raise KeyError(f"无法通过 import 解析 workflow node type: {tk!r}")

    @staticmethod
    def load_workflow_node_class_from_source(
        source: str, *, module_name: str = "__workflow_node_source__"
    ) -> type[Node]:
        """Load the first ``@workflow_node``-decorated Node class from python source."""
        import workflow as workflow_lib

        tree = ast.parse(source)
        class_names_in_order: list[str] = [n.name for n in tree.body if isinstance(n, ast.ClassDef)]

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
