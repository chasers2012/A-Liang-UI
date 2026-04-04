"""Load a Factor subclass from user-written Python source."""

from __future__ import annotations

import numpy as np
import pandas as pd
from custom_code import Inheritance

from factor.factor import Factor

FACTOR_GLOBALS: dict[str, object] = {
    "np": np,
    "pd": pd,
    "Factor": Factor,
}

_inheritance = Inheritance(Factor)


def is_valid_factor_class(source: str) -> tuple[type[Factor], str]:
    return _inheritance.is_valid_subclass(source)


__all__ = ["FACTOR_GLOBALS", "is_valid_factor_class"]
