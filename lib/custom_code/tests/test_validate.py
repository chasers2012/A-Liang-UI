from __future__ import annotations

import pytest
from custom_code import validate_identifier_name, validate_source_syntax


def test_validate_source_syntax_ok() -> None:
    validate_source_syntax("a = 1\n")


def test_validate_source_syntax_empty() -> None:
    with pytest.raises(ValueError, match="不能为空"):
        validate_source_syntax("")


def test_validate_source_syntax_bad() -> None:
    with pytest.raises(ValueError, match="语法错误"):
        validate_source_syntax("def bad(")


def test_validate_identifier_name_ok() -> None:
    validate_identifier_name("mom_10d")


def test_validate_identifier_name_bad() -> None:
    with pytest.raises(ValueError, match="标识符"):
        validate_identifier_name("123bad")
    with pytest.raises(ValueError, match="关键字"):
        validate_identifier_name("class")
