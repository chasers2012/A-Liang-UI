"""
Abstract base type for evaluation metrics.

Concrete metrics subclass :class:`EvaluationMetric` and implement :meth:`evaluate`
with domain-specific arguments and return values.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

TResult = TypeVar("TResult")


class EvaluationMetric(ABC, Generic[TResult]):
    """
    Pluggable evaluation metric.

    Subclasses implement :meth:`evaluate` to compute a scalar, structured record,
    or other result from inputs (e.g. factor values, forward returns, labels).

    Optional class attribute ``VISUALIZATION`` (``dict``) may suggest default UI
    rendering when the metric is first created; the persisted setting is edited
    in the API / web UI and stored on the metric record. Example::

        VISUALIZATION = {"mode": "table", "period_day_keys": False}
    """

    @abstractmethod
    def evaluate(self, *args: Any, **kwargs: Any) -> TResult:
        """
        Compute the metric.

        Parameter names and types are defined by each subclass; the base signature
        stays flexible so different metrics (IC, Sharpe, custom scores) can coexist.
        """
        ...
