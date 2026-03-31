"""Load a user-defined subclass from source: strip fences, AST match, restricted exec."""

from __future__ import annotations

import ast
from collections.abc import Callable
from typing import Generic, TypeVar

TBase = TypeVar("TBase")

InvalidMessage = str | Callable[[str], str]


def direct_base_symbol_name(expr: ast.expr) -> str | None:
    """Symbol used for direct inheritance, unwrapping generics (e.g. ``M[T]`` -> ``M``)."""
    if isinstance(expr, ast.Subscript):
        return direct_base_symbol_name(expr.value)
    if isinstance(expr, ast.Name):
        return expr.id
    if isinstance(expr, ast.Attribute):
        return expr.attr
    return None


def find_subclass_name(module_ast: ast.Module, base_name: str) -> str | None:

    for node in module_ast.body:
        if not isinstance(node, ast.ClassDef):
            continue
        # for base in node.bases:
        #     sym = direct_base_symbol_name(base)
        #     if sym is not None and sym == base_name:
        #         return node.name
        for base in node.bases:
            # 处理 class A(BaseClass)
            if isinstance(base, ast.Name):
                if base.id == base_name:
                    return node.name

            # 处理 class A(module.BaseClass)
            elif isinstance(base, ast.Attribute) and base.attr == base_name:
                return node.name
    return None


class Inheritance(Generic[TBase]):
    """Pre-configured subclass loader bound to a specific base type.

    Encapsulates base class, injectable globals, AST matching names, exec
    filename, and error messages so that callers only need to pass source code.
    """

    def __init__(
        self,
        base: type[TBase],
    ) -> None:
        self.base = base
        self.base_name = base.__name__

    def is_valid_subclass(self, source: str) -> bool:
        """Parse *source*, exec in sandboxed globals, return ``(cls, class_name)``."""
        module_ast = ast.parse(source)
        sub_cls = find_subclass_name(module_ast, self.base.__name__)
        return sub_cls is not None
