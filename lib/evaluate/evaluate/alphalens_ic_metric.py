"""Alphalens factor IC as an :class:`~evaluate.evaluation_metric.EvaluationMetric`."""
from __future__ import annotations

import pandas as pd

from .evaluation_metric import EvaluationMetric


class FactorInformationCoefficientMetric(EvaluationMetric[pd.DataFrame]):
    """
    Spearman rank IC time series via Alphalens
    ``performance.factor_information_coefficient``.
    """

    def evaluate(
        self,
        input_data: pd.DataFrame,
    ) -> pd.DataFrame:
        import alphalens as al
        return al.performance.factor_information_coefficient(
            input_data,
            group_adjust=False,
            by_group=False,
        )


class MeanInformationCoefficientMetric(EvaluationMetric[pd.Series
                                                        | pd.DataFrame]):
    """
    Mean IC via Alphalens ``performance.mean_information_coefficient``.

    With default ``by_time=None`` and ``by_group=False``, returns a
    :class:`pandas.Series` (one value per forward-return period), matching
    :class:`~evaluate.factor_evaluator.AlphalensMetrics`. Other argument
    combinations may yield a :class:`pandas.DataFrame`.
    """

    def evaluate(self,
                 factor_data_clean: pd.DataFrame) -> pd.Series | pd.DataFrame:
        import alphalens as al

        return al.performance.mean_information_coefficient(
            factor_data_clean,
            group_adjust=False,
            by_group=False,
            by_time=None,
        )
