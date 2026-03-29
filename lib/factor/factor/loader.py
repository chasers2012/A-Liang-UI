"""Load a Factor subclass from user-written Python source."""

from __future__ import annotations

import numpy as np
import pandas as pd
from custom_code import Inheritance, strip_markdown_fences

from factor.factor import Factor

FACTOR_GLOBALS: dict[str, object] = {
    "np": np,
    "pd": pd,
    "Factor": Factor,
}

_inheritance = Inheritance(
    Factor,
    FACTOR_GLOBALS,
    exec_filename="<factor>",
    missing_message="源码中未找到继承 Factor 的类",
    invalid_message=lambda n: f"{n} 不是有效的 Factor 子类",
)


def load_factor_class(source: str) -> tuple[type[Factor], str]:
    return _inheritance.load_from_source(source)


__all__ = ["FACTOR_GLOBALS", "load_factor_class", "strip_markdown_fences"]
