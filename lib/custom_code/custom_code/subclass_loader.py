"""Load a user-defined subclass from source: strip fences, AST match, restricted exec."""

from __future__ import annotations

import ast
import re
from collections.abc import Callable
from typing import Any, Generic, TypeVar

TBase = TypeVar("TBase")

InvalidMessage = str | Callable[[str], str]


def strip_markdown_fences(src: str) -> str:
    s = src.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9]*\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def direct_base_symbol_name(expr: ast.expr) -> str | None:
    """Symbol used for direct inheritance, unwrapping generics (e.g. ``M[T]`` -> ``M``)."""
    if isinstance(expr, ast.Subscript):
        return direct_base_symbol_name(expr.value)
    if isinstance(expr, ast.Name):
        return expr.id
    if isinstance(expr, ast.Attribute):
        return expr.attr
    return None


def find_subclass_name(module_ast: ast.Module, base_names: frozenset[str]) -> str | None:
    for node in module_ast.body:
        if not isinstance(node, ast.ClassDef):
            continue
        for base in node.bases:
            sym = direct_base_symbol_name(base)
            if sym is not None and sym in base_names:
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
        inject_globals: dict[str, Any],
        *,
        exec_filename: str = "<user_code>",
        missing_message: str = "源码中未找到匹配的子类",
        invalid_message: InvalidMessage = "不是有效的子类",
        base_ast_names: frozenset[str] | None = None,
    ) -> None:
        self.base = base
        self.inject_globals = inject_globals
        self.exec_filename = exec_filename
        self.missing_message = missing_message
        self.invalid_message = invalid_message
        self.base_ast_names = (
            base_ast_names if base_ast_names is not None else frozenset({base.__name__})
        )

    def find_in_ast(self, module_ast: ast.Module) -> str | None:
        """Find a subclass name in a parsed AST module."""
        return find_subclass_name(module_ast, self.base_ast_names)

    def load_from_source(self, source: str) -> tuple[type[TBase], str]:
        """Parse *source*, exec in sandboxed globals, return ``(cls, class_name)``."""
        cleaned = strip_markdown_fences(source)
        tree = ast.parse(cleaned)
        class_name = self.find_in_ast(tree)
        if not class_name:
            raise ValueError(self.missing_message)

        ns = dict(self.inject_globals)
        exec(compile(tree, filename=self.exec_filename, mode="exec"), ns, ns)
        cls = ns.get(class_name)
        if cls is None or not isinstance(cls, type) or not issubclass(cls, self.base):
            msg = (
                self.invalid_message(class_name)
                if callable(self.invalid_message)
                else self.invalid_message
            )
            raise ValueError(msg)
        return cls, class_name
