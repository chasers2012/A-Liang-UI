"""Load an EvaluationMetric subclass from user source."""

from __future__ import annotations

import numpy as np
import pandas as pd
from custom_code import load_subclass_from_source
from evaluate import EvaluationMetric

METRIC_GLOBALS = {
    "np": np,
    "pd": pd,
    "EvaluationMetric": EvaluationMetric,
}


def load_evaluation_metric_class(source: str) -> tuple[type[EvaluationMetric], str]:
    return load_subclass_from_source(
        source,
        base=EvaluationMetric,
        inject_globals=METRIC_GLOBALS,
        exec_filename="<evaluation_metric>",
        missing_message="源码中未找到继承 EvaluationMetric 的类",
        invalid_message=lambda n: f"{n} 不是有效的 EvaluationMetric 子类",
    )
