from typing import ClassVar

from app.nodes.node_plugin import NodePlugin
from workflow import Node

from alphalens_nodes.average_cumulative_return_by_quantile_metric import (
    AverageCumulativeReturnByQuantileMetric,
)
from alphalens_nodes.common_start_returns_metric import CommonStartReturnsMetric
from alphalens_nodes.compute_mean_returns_spread_metric import ComputeMeanReturnsSpreadMetric
from alphalens_nodes.create_pyfolio_input_metric import CreatePyfolioInputMetric
from alphalens_nodes.cumulative_returns_metric import CumulativeReturnsMetric
from alphalens_nodes.factor_alpha_beta_metric import FactorAlphaBetaMetric
from alphalens_nodes.factor_cumulative_returns_metric import FactorCumulativeReturnsMetric
from alphalens_nodes.factor_positions_metric import FactorPositionsMetric
from alphalens_nodes.factor_rank_autocorrelation_metric import FactorRankAutocorrelationMetric
from alphalens_nodes.factor_returns_metric import FactorReturnsMetric
from alphalens_nodes.factor_weights_metric import FactorWeightsMetric
from alphalens_nodes.ic_metric import ICMetric
from alphalens_nodes.mean_ic import MeanIC
from alphalens_nodes.mean_return_by_quantile_metric import MeanReturnByQuantileMetric
from alphalens_nodes.positions_metric import PositionsMetric
from alphalens_nodes.quantile_cumulative_returns_metric import QuantileCumulativeReturnsMetric
from alphalens_nodes.quantile_turnover_metric import QuantileTurnoverMetric
from alphalens_nodes.rate_of_return_metric import RateOfReturnMetric
from alphalens_nodes.std_conversion_metric import StdConversionMetric
from alphalens_nodes.top_bottom_spread_timeseries_metric import TopBottomSpreadTimeSeriesMetric


class AlphalensNodesPlugin(NodePlugin):
    name = "alphalens"
    visible_domains = ("evaluation-profile",)
    nodes: ClassVar[list[type[Node]]] = [
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
    ]
