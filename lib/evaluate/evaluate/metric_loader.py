"""Load an EvaluationMetric subclass from user-written Python source."""

from __future__ import annotations

from custom_code import Inheritance

from .evaluation_metric import EvaluationMetric

_inheritance = Inheritance(EvaluationMetric)


def is_valid_evaluation_metric_class(source: str) -> tuple[type[EvaluationMetric], str]:
    return _inheritance.is_valid_subclass(source)
