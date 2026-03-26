from __future__ import annotations

import ast
import keyword


def validate_factor_name(name: str) -> None:
    n = name.strip()
    if not n:
        raise ValueError("name 不能为空")
    if not n.isidentifier():
        raise ValueError("name 须为合法 Python 标识符")
    if keyword.iskeyword(n):
        raise ValueError("name 不能为 Python 关键字")


def validate_source_syntax(source: str) -> None:
    if not source or not source.strip():
        raise ValueError("源码不能为空")
    try:
        ast.parse(source)
    except SyntaxError as e:
        raise ValueError(f"Python 语法错误: {e.msg} (行 {e.lineno})") from e
