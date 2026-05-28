"""Alphalens workflow node plugin package."""

from .performance import (
    AverageCumulativeReturnByQuantileMetric,
    CommonStartReturnsMetric,
    ComputeMeanReturnsSpreadMetric,
    CreatePyfolioInputMetric,
    CumulativeReturnsMetric,
    FactorAlphaBetaMetric,
    FactorCumulativeReturnsMetric,
    FactorPositionsMetric,
    FactorRankAutocorrelationMetric,
    FactorReturnsMetric,
    FactorWeightsMetric,
    ICMetric,
    MeanIC,
    MeanReturnByQuantileMetric,
    PositionsMetric,
    QuantileCumulativeReturnsMetric,
    QuantileTurnoverMetric,
    RateOfReturnMetric,
    StdConversionMetric,
    TopBottomSpreadTimeSeriesMetric,
)
from .utils import GetCleanFactorAndForwardReturnsMetric

__all__ = [
    "AlphalensNodesPlugin",
    "AverageCumulativeReturnByQuantileMetric",
    "CommonStartReturnsMetric",
    "ComputeMeanReturnsSpreadMetric",
    "CreatePyfolioInputMetric",
    "CumulativeReturnsMetric",
    "FactorAlphaBetaMetric",
    "FactorCumulativeReturnsMetric",
    "FactorPositionsMetric",
    "FactorRankAutocorrelationMetric",
    "FactorReturnsMetric",
    "FactorWeightsMetric",
    "GetCleanFactorAndForwardReturnsMetric",
    "ICMetric",
    "MeanIC",
    "MeanReturnByQuantileMetric",
    "PositionsMetric",
    "QuantileCumulativeReturnsMetric",
    "QuantileTurnoverMetric",
    "RateOfReturnMetric",
    "StdConversionMetric",
    "TopBottomSpreadTimeSeriesMetric",
]


def __getattr__(name: str):
    if name == "AlphalensNodesPlugin":
        from .plugin import AlphalensNodesPlugin

        return AlphalensNodesPlugin
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
