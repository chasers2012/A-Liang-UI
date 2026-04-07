"""Composable workflow template for returns tear sheet (main branch only)."""

from __future__ import annotations

from workflow import Node, WorkflowGraph, WorkflowLink

from evaluation_workflow_nodes.alphalens_performance_nodes.compute_mean_returns_spread_metric import (
    ComputeMeanReturnsSpreadMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.factor_alpha_beta_metric import (
    FactorAlphaBetaMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.factor_cumulative_returns_metric import (
    FactorCumulativeReturnsMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.factor_returns_metric import (
    FactorReturnsMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.mean_return_by_quantile_metric import (
    MeanReturnByQuantileMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.rate_of_return_metric import (
    RateOfReturnMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.returns_tear_structured_output_node import (
    ReturnsTearStructuredOutputNode,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.std_conversion_metric import (
    StdConversionMetric,
)
from evaluation_workflow_nodes.calculate_factor_value import CalculateFactorValueNode
from evaluation_workflow_nodes.collect_result import CollectResult
from evaluation_workflow_nodes.load_data_set import LoadDataSet
from evaluation_workflow_nodes.visiualization.echarts_line import EchartsLineNode


def build_returns_tear_workflow_template() -> dict:
    load_type = LoadDataSet().type
    calc_type = CalculateFactorValueNode().type
    factor_returns_type = FactorReturnsMetric().type
    mean_return_type = MeanReturnByQuantileMetric().type
    rate_of_return_type = RateOfReturnMetric().type
    std_conversion_type = StdConversionMetric().type
    alpha_beta_type = FactorAlphaBetaMetric().type
    spread_type = ComputeMeanReturnsSpreadMetric().type
    cumulative_type = FactorCumulativeReturnsMetric().type
    structured_type = ReturnsTearStructuredOutputNode().type
    echarts_type = EchartsLineNode().type
    collect_type = CollectResult().type

    graph = WorkflowGraph(
        nodes=[
            Node(id="load", type=load_type, pos=[0, 0]),
            Node(id="calc", type=calc_type, pos=[220, 0]),
            Node(id="factor_returns", type=factor_returns_type, pos=[460, -200]),
            Node(
                id="mean_return_pooled",
                type=mean_return_type,
                pos=[460, -50],
                params={"by_date": False, "demeaned": True, "group_adjust": False},
            ),
            Node(
                id="mean_return_bydate",
                type=mean_return_type,
                pos=[460, 100],
                params={"by_date": True, "demeaned": True, "group_adjust": False},
            ),
            Node(id="rate_ret", type=rate_of_return_type, pos=[700, -50]),
            Node(id="rate_ret_bydate", type=rate_of_return_type, pos=[700, 100]),
            Node(id="std_conv", type=std_conversion_type, pos=[700, 230]),
            Node(id="alpha_beta", type=alpha_beta_type, pos=[700, -200]),
            Node(id="spread", type=spread_type, pos=[940, 130]),
            Node(
                id="factor_cumret_1d",
                type=cumulative_type,
                pos=[940, -200],
                params={"period": "1D", "long_short": True, "group_neutral": False},
            ),
            Node(id="structured", type=structured_type, pos=[1180, -80]),
            Node(id="echarts", type=echarts_type, pos=[1420, 120]),
            Node(id="collect", type=collect_type, pos=[1640, 20]),
        ],
        links=[
            WorkflowLink(
                from_node="load", from_socket="data_set", to_node="calc", to_socket="data_set"
            ),
            WorkflowLink(
                from_node="calc",
                from_socket="clean_factor",
                to_node="factor_returns",
                to_socket="clean_factor",
            ),
            WorkflowLink(
                from_node="calc",
                from_socket="clean_factor",
                to_node="mean_return_pooled",
                to_socket="clean_factor",
            ),
            WorkflowLink(
                from_node="calc",
                from_socket="clean_factor",
                to_node="mean_return_bydate",
                to_socket="clean_factor",
            ),
            WorkflowLink(
                from_node="factor_returns",
                from_socket="returns",
                to_node="alpha_beta",
                to_socket="returns",
            ),
            WorkflowLink(
                from_node="calc",
                from_socket="clean_factor",
                to_node="alpha_beta",
                to_socket="clean_factor",
            ),
            WorkflowLink(
                from_node="mean_return_pooled",
                from_socket="mean_return_by_quantile",
                to_node="rate_ret",
                to_socket="returns",
            ),
            WorkflowLink(
                from_node="mean_return_bydate",
                from_socket="mean_return_by_quantile",
                to_node="rate_ret_bydate",
                to_socket="returns",
            ),
            WorkflowLink(
                from_node="mean_return_bydate",
                from_socket="mean_return_by_quantile_std_error",
                to_node="std_conv",
                to_socket="std",
            ),
            WorkflowLink(
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="spread",
                to_socket="mean_returns",
            ),
            WorkflowLink(
                from_node="std_conv",
                from_socket="std_converted",
                to_node="spread",
                to_socket="std_err",
            ),
            WorkflowLink(
                from_node="calc",
                from_socket="clean_factor",
                to_node="factor_cumret_1d",
                to_socket="clean_factor",
            ),
            WorkflowLink(
                from_node="alpha_beta",
                from_socket="alpha_beta",
                to_node="structured",
                to_socket="alpha_beta",
            ),
            WorkflowLink(
                from_node="rate_ret",
                from_socket="rate_of_return",
                to_node="structured",
                to_socket="mean_quant_rateret",
            ),
            WorkflowLink(
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="structured",
                to_socket="mean_quant_rateret_bydate",
            ),
            WorkflowLink(
                from_node="spread",
                from_socket="mean_return_spread",
                to_node="structured",
                to_socket="mean_ret_spread_quant",
            ),
            WorkflowLink(
                from_node="spread",
                from_socket="mean_return_spread_std_error",
                to_node="structured",
                to_socket="std_spread_quant",
            ),
            WorkflowLink(
                from_node="factor_cumret_1d",
                from_socket="cumulative_returns",
                to_node="structured",
                to_socket="factor_returns_1d",
            ),
            WorkflowLink(
                from_node="structured",
                from_socket="chart_payloads",
                to_node="echarts",
                to_socket="payload",
            ),
            WorkflowLink(
                from_node="structured",
                from_socket="structured",
                to_node="collect",
                to_socket="result",
            ),
            WorkflowLink(
                from_node="echarts", from_socket="option", to_node="collect", to_socket="result"
            ),
        ],
    )
    return graph.serialize()
