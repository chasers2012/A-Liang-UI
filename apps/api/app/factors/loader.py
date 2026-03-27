"""Load a Factor subclass from user source (same rules as agent.codegen)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from custom_code import load_subclass_from_source, strip_markdown_fences
from factor.factor import Factor

FACTOR_GLOBALS = {
    "np": np,
    "pd": pd,
    "Factor": Factor,
}


def load_factor_class(source: str) -> tuple[type[Factor], str]:
    return load_subclass_from_source(
        source,
        base=Factor,
        inject_globals=FACTOR_GLOBALS,
        exec_filename="<factor>",
        missing_message="源码中未找到继承 Factor 的类",
        invalid_message=lambda n: f"{n} 不是有效的 Factor 子类",
    )


__all__ = ["FACTOR_GLOBALS", "load_factor_class", "strip_markdown_fences"]
