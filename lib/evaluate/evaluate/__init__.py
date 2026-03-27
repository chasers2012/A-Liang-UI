from factor.batch import (
    compute_factor_values,
    compute_factor_values_from_source,
    max_lookback,
    merged_dependencies,
)

from .evaluation_metric import EvaluationMetric

_ALPHALENS_EXPORTS = frozenset(
    {
        "AlphalensEvaluateResult",
        "AlphalensFactorEvaluator",
        "AlphalensMetrics",
        "FactorInformationCoefficientMetric",
        "MeanInformationCoefficientMetric",
        "close_prices_wide",
        "compute_forward_return_from_wide",
    }
)


def __getattr__(name: str):
    if name in _ALPHALENS_EXPORTS:
        import evaluate.factor_evaluator as _fe

        return getattr(_fe, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "AlphalensEvaluateResult",
    "AlphalensFactorEvaluator",
    "AlphalensMetrics",
    "EvaluationMetric",
    "FactorInformationCoefficientMetric",
    "MeanInformationCoefficientMetric",
    "close_prices_wide",
    "compute_factor_values",
    "compute_factor_values_from_source",
    "compute_forward_return_from_wide",
    "max_lookback",
    "merged_dependencies",
]
