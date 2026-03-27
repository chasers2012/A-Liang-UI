from __future__ import annotations

import ast

import pytest
from custom_code import (
    find_subclass_name,
    load_subclass_from_source,
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


def test_load_subclass_from_source() -> None:
    src = """
class Good(_Base):
    pass
"""
    cls, name = load_subclass_from_source(
        src,
        base=_Base,
        inject_globals={"_Base": _Base},
        exec_filename="<t>",
        missing_message="no",
        invalid_message="bad",
    )
    assert name == "Good"
    assert issubclass(cls, _Base)


def test_load_subclass_missing() -> None:
    with pytest.raises(ValueError, match="missing"):
        load_subclass_from_source(
            "x = 1\n",
            base=_Base,
            inject_globals={"_Base": _Base},
            exec_filename="<t>",
            missing_message="missing",
            invalid_message="bad",
        )
