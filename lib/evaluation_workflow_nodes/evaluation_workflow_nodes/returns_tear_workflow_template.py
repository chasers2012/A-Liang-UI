"""Composable workflow template for returns tear sheet (main branch only)."""

from __future__ import annotations

from workflow import WORKFLOW_OUTPUT_NODE_ID, Node, Socket, WorkflowGraph, WorkflowLink

from evaluation_workflow_nodes.alphalens_performance_nodes.compute_mean_returns_spread_metric import (
    ComputeMeanReturnsSpreadMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.factor_cumulative_returns_metric import (
    FactorCumulativeReturnsMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.mean_return_by_quantile_metric import (
    MeanReturnByQuantileMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.quantile_cumulative_returns_metric import (
    QuantileCumulativeReturnsMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.rate_of_return_metric import (
    RateOfReturnMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.std_conversion_metric import (
    StdConversionMetric,
)
from evaluation_workflow_nodes.alphalens_performance_nodes.top_bottom_spread_timeseries_metric import (
    TopBottomSpreadTimeSeriesMetric,
)
from evaluation_workflow_nodes.calculate_factor_value import CalculateFactorValueNode
from evaluation_workflow_nodes.load_data_set import LoadDataSet
from evaluation_workflow_nodes.visiualization.echarts_line import EchartsLineNode


def build_returns_tear_workflow_template() -> dict:
    load_type = LoadDataSet().type
    calc_type = CalculateFactorValueNode().type
    mean_return_type = MeanReturnByQuantileMetric().type
    rate_of_return_type = RateOfReturnMetric().type
    quantile_cumret_type = QuantileCumulativeReturnsMetric().type
    top_bottom_spread_ts_type = TopBottomSpreadTimeSeriesMetric().type
    std_conversion_type = StdConversionMetric().type
    spread_type = ComputeMeanReturnsSpreadMetric().type
    cumulative_type = FactorCumulativeReturnsMetric().type
    echarts_type = EchartsLineNode().type

    graph = WorkflowGraph(
        nodes=[
            Node(id="load", type=load_type, pos=[0, 0]),
            Node(id="calc", type=calc_type, pos=[220, 0]),
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
            Node(id="spread", type=spread_type, pos=[940, 130]),
            Node(
                id="top_bottom_1d",
                type=top_bottom_spread_ts_type,
                pos=[940, 260],
                params={"period": "1D", "upper_quant": 5, "lower_quant": 1, "rolling_window": 22},
            ),
            Node(
                id="top_bottom_5d",
                type=top_bottom_spread_ts_type,
                pos=[940, 390],
                params={"period": "5D", "upper_quant": 5, "lower_quant": 1, "rolling_window": 22},
            ),
            Node(
                id="top_bottom_10d",
                type=top_bottom_spread_ts_type,
                pos=[940, 520],
                params={"period": "10D", "upper_quant": 5, "lower_quant": 1, "rolling_window": 22},
            ),
            Node(
                id="top_bottom_20d",
                type=top_bottom_spread_ts_type,
                pos=[940, 650],
                params={"period": "20D", "upper_quant": 5, "lower_quant": 1, "rolling_window": 22},
            ),
            Node(
                id="factor_cumret_1d",
                type=cumulative_type,
                pos=[940, -200],
                params={"period": "1D", "long_short": True, "group_neutral": False},
            ),
            Node(
                id="cumret_by_quantile_1d",
                type=quantile_cumret_type,
                pos=[940, -60],
                params={"period": "1D"},
            ),
            Node(
                id="echarts_mean_q",
                type=echarts_type,
                pos=[1180, -180],
                params={
                    "title": "Mean Return by Quantile",
                    "series_type": "bar",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_bydate",
                type=echarts_type,
                pos=[1180, -40],
                params={
                    "title": "Quantile Returns by Date",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_spread",
                type=echarts_type,
                pos=[1180, 100],
                params={
                    "title": "Mean Quantile Return Spread",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_cumret",
                type=echarts_type,
                pos=[1180, 240],
                params={
                    "title": "Factor Portfolio Cumulative Return (1D)",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_cumret_byq_1d",
                type=echarts_type,
                pos=[1180, 380],
                params={
                    "title": "Cumulative Return by Quantile (1D)",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_top_bottom_1d",
                type=echarts_type,
                pos=[1180, 520],
                params={
                    "title": "Top Minus Bottom Quantile Mean Return (1D)",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_top_bottom_5d",
                type=echarts_type,
                pos=[1180, 660],
                params={
                    "title": "Top Minus Bottom Quantile Mean Return (5D)",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_top_bottom_10d",
                type=echarts_type,
                pos=[1180, 800],
                params={
                    "title": "Top Minus Bottom Quantile Mean Return (10D)",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
            Node(
                id="echarts_top_bottom_20d",
                type=echarts_type,
                pos=[1180, 940],
                params={
                    "title": "Top Minus Bottom Quantile Mean Return (20D)",
                    "series_type": "line",
                    "y_fields": "*",
                    "show_legend": True,
                    "show_tooltip": True,
                },
            ),
        ],
        workflow_outputs=[
            Socket(name="result", required=False, value_type="scalar_json", label="结果")
        ],
        links=[
            WorkflowLink(
                from_node="load", from_socket="data_set", to_node="calc", to_socket="data_set"
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
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="top_bottom_1d",
                to_socket="mean_returns_bydate",
            ),
            WorkflowLink(
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="top_bottom_5d",
                to_socket="mean_returns_bydate",
            ),
            WorkflowLink(
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="top_bottom_10d",
                to_socket="mean_returns_bydate",
            ),
            WorkflowLink(
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="top_bottom_20d",
                to_socket="mean_returns_bydate",
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
                from_node="rate_ret",
                from_socket="rate_of_return",
                to_node="echarts_mean_q",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="echarts_bydate",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="spread",
                from_socket="mean_return_spread",
                to_node="echarts_spread",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="factor_cumret_1d",
                from_socket="cumulative_returns",
                to_node="echarts_cumret",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="rate_ret_bydate",
                from_socket="rate_of_return",
                to_node="cumret_by_quantile_1d",
                to_socket="mean_returns_bydate",
            ),
            WorkflowLink(
                from_node="cumret_by_quantile_1d",
                from_socket="cumulative_returns_by_quantile",
                to_node="echarts_cumret_byq_1d",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="top_bottom_1d",
                from_socket="spread_ts",
                to_node="echarts_top_bottom_1d",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="top_bottom_5d",
                from_socket="spread_ts",
                to_node="echarts_top_bottom_5d",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="top_bottom_10d",
                from_socket="spread_ts",
                to_node="echarts_top_bottom_10d",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="top_bottom_20d",
                from_socket="spread_ts",
                to_node="echarts_top_bottom_20d",
                to_socket="data",
            ),
            WorkflowLink(
                from_node="echarts_mean_q",
                from_socket="option",
                to_node=WORKFLOW_OUTPUT_NODE_ID,
                to_socket="result",
            ),
            WorkflowLink(
                from_node="echarts_bydate",
                from_socket="option",
                to_node=WORKFLOW_OUTPUT_NODE_ID,
                to_socket="result",
            ),
            WorkflowLink(
                from_node="echarts_spread",
                from_socket="option",
                to_node=WORKFLOW_OUTPUT_NODE_ID,
                to_socket="result",
            ),
            WorkflowLink(
                from_node="echarts_cumret",
                from_socket="option",
                to_node=WORKFLOW_OUTPUT_NODE_ID,
                to_socket="result",
            ),
        ],
    )
    return graph.serialize()
