from typing import ClassVar

from app.nodes.node_plugin import NodePlugin
from workflow import Node

from alphalens_nodes.performance.average_cumulative_return_by_quantile_metric import (
    AverageCumulativeReturnByQuantileMetric,
)
from alphalens_nodes.performance.common_start_returns_metric import CommonStartReturnsMetric
from alphalens_nodes.performance.compute_mean_returns_spread_metric import (
    ComputeMeanReturnsSpreadMetric,
)
from alphalens_nodes.performance.create_pyfolio_input_metric import CreatePyfolioInputMetric
from alphalens_nodes.performance.cumulative_returns_metric import CumulativeReturnsMetric
from alphalens_nodes.performance.factor_alpha_beta_metric import FactorAlphaBetaMetric
from alphalens_nodes.performance.factor_cumulative_returns_metric import (
    FactorCumulativeReturnsMetric,
)
from alphalens_nodes.performance.factor_positions_metric import FactorPositionsMetric
from alphalens_nodes.performance.factor_rank_autocorrelation_metric import (
    FactorRankAutocorrelationMetric,
)
from alphalens_nodes.performance.factor_returns_metric import FactorReturnsMetric
from alphalens_nodes.performance.factor_weights_metric import FactorWeightsMetric
from alphalens_nodes.performance.ic_metric import ICMetric
from alphalens_nodes.performance.mean_ic import MeanIC
from alphalens_nodes.performance.mean_return_by_quantile_metric import MeanReturnByQuantileMetric
from alphalens_nodes.performance.positions_metric import PositionsMetric
from alphalens_nodes.performance.quantile_cumulative_returns_metric import (
    QuantileCumulativeReturnsMetric,
)
from alphalens_nodes.performance.quantile_turnover_metric import QuantileTurnoverMetric
from alphalens_nodes.performance.rate_of_return_metric import RateOfReturnMetric
from alphalens_nodes.performance.std_conversion_metric import StdConversionMetric
from alphalens_nodes.performance.top_bottom_spread_timeseries_metric import (
    TopBottomSpreadTimeSeriesMetric,
)
from alphalens_nodes.utils.get_clean_factor_and_forward_returns_metric import (
    GetCleanFactorAndForwardReturnsMetric,
)


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
        GetCleanFactorAndForwardReturnsMetric,
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
