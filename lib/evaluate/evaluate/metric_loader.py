"""Load an EvaluationMetric subclass from user-written Python source."""

from __future__ import annotations

import numpy as np
import pandas as pd
from custom_code import Inheritance

from .evaluation_metric import EvaluationMetric

METRIC_GLOBALS: dict[str, object] = {
    "np": np,
    "pd": pd,
    "EvaluationMetric": EvaluationMetric,
}

_inheritance = Inheritance(
    EvaluationMetric,
    METRIC_GLOBALS,
    exec_filename="<evaluation_metric>",
    missing_message="源码中未找到继承 EvaluationMetric 的类",
    invalid_message=lambda n: f"{n} 不是有效的 EvaluationMetric 子类",
    base_ast_names=frozenset(
        {
            "EvaluationMetric",
            "MeanInformationCoefficientMetric",
            "MeanReturnSpreadMetric",
        }
    ),
)


def load_evaluation_metric_class(source: str) -> tuple[type[EvaluationMetric], str]:
    return _inheritance.load_from_source(source)
