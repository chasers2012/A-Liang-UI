from __future__ import annotations

import ast

from custom_code import (
    find_subclass_name,
    strip_markdown_fences,
)


class _Base:
    pass


def test_strip_markdown_fences() -> None:
    raw = "```python\nclass X(_Base):\n    pass\n```"
    assert "class X" in strip_markdown_fences(raw)


def test_find_subclass_generic_base() -> None:
    tree = ast.parse("class M(_Base[int]):\n    pass\n")
    assert find_subclass_name(tree, frozenset({"_Base"})) == "M"
