"""Load a user-defined subclass from source: strip fences, AST match, restricted exec."""

from __future__ import annotations

import ast
import re
from typing import Any, Callable, FrozenSet, Optional, TypeVar, Union

TBase = TypeVar("TBase")

InvalidMessage = Union[str, Callable[[str], str]]


def strip_markdown_fences(src: str) -> str:
    s = src.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9]*\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def direct_base_symbol_name(expr: ast.expr) -> Optional[str]:
    """Symbol used for direct inheritance, unwrapping generics (e.g. ``M[T]`` → ``M``)."""
    if isinstance(expr, ast.Subscript):
        return direct_base_symbol_name(expr.value)
    if isinstance(expr, ast.Name):
        return expr.id
    if isinstance(expr, ast.Attribute):
        return expr.attr
    return None


def find_subclass_name(module_ast: ast.Module, base_names: FrozenSet[str]) -> Optional[str]:
    for node in module_ast.body:
        if not isinstance(node, ast.ClassDef):
            continue
        for base in node.bases:
            sym = direct_base_symbol_name(base)
            if sym is not None and sym in base_names:
                return node.name
    return None


def load_subclass_from_source(
    source: str,
    *,
    base: type[TBase],
    inject_globals: dict[str, Any],
    exec_filename: str,
    missing_message: str,
    invalid_message: InvalidMessage,
    base_ast_names: Optional[FrozenSet[str]] = None,
) -> tuple[type[TBase], str]:
    """
    Parse *source*, execute in a copy of *inject_globals*, return ``(cls, name)``.

    *base_ast_names* defaults to ``{base.__name__}`` for matching the inheritance AST.
    """
    cleaned = strip_markdown_fences(source)
    tree = ast.parse(cleaned)
    names = base_ast_names if base_ast_names is not None else frozenset({base.__name__})
    class_name = find_subclass_name(tree, names)
    if not class_name:
        raise ValueError(missing_message)

    ns = dict(inject_globals)
    exec(compile(tree, filename=exec_filename, mode="exec"), ns, ns)
    cls = ns.get(class_name)
    if cls is None or not isinstance(cls, type) or not issubclass(cls, base):
        msg = invalid_message(class_name) if callable(invalid_message) else invalid_message
        raise ValueError(msg)
    return cls, class_name
