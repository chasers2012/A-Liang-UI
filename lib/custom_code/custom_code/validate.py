"""Source-code validation: syntax check (ast.parse) and Python identifier rules."""

from __future__ import annotations

import ast


def validate_source_syntax(source: str) -> None:
    """Raise ``ValueError`` if *source* is empty or has a Python syntax error."""
    if not source or not source.strip():
        raise ValueError("源码不能为空")
    try:
        ast.parse(source)
    except SyntaxError as e:
        raise ValueError(f"Python 语法错误: {e.msg} (行 {e.lineno})") from e


def validate_identifier_name(name: str) -> None:
    """Raise ``ValueError`` if *name* is not a legal, non-keyword Python identifier."""
    n = name.strip()
    if not n:
        raise ValueError("name 不能为空")
