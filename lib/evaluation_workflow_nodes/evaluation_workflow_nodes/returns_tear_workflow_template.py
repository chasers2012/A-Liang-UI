"""Composable workflow template for returns tear sheet (main branch only)."""

from __future__ import annotations

from workflow import Node, Socket, WorkflowEndpoint, WorkflowGraph, WorkflowLink

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
from evaluation_workflow_nodes.constants import (
    VALUE_TYPE_DATA_SET,
    VALUE_TYPE_FACTOR,
    VALUE_TYPE_SCALAR_JSON,
)
from evaluation_workflow_nodes.load_data_set import LoadDataSet
from evaluation_workflow_nodes.visiualization.echarts import EchartsLineNode


def build_returns_tear_workflow_template() -> dict:
    def n(node_id: str, socket: str) -> WorkflowEndpoint:
        return WorkflowEndpoint(kind="node", node_id=node_id, socket=socket)

    def wi(socket: str) -> WorkflowEndpoint:
        return WorkflowEndpoint(kind="workflow_input", socket=socket)

    def wo(socket: str) -> WorkflowEndpoint:
        return WorkflowEndpoint(kind="workflow_output", socket=socket)

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
        workflow_inputs=[
            Socket(
                name="data_set",
                required=True,
                value_type=VALUE_TYPE_DATA_SET,
                label="数据集",
                description="评价所使用的数据集实例",
            ),
            Socket(
                name="factor",
                required=True,
                value_type=VALUE_TYPE_FACTOR,
                label="因子",
                description="评价目标因子（运行时由 factor_id 注入）",
            ),
        ],
        workflow_outputs=[
            Socket(
                name="result",
                required=False,
                value_type=VALUE_TYPE_SCALAR_JSON,
                label="结果",
            )
        ],
        links=[
            WorkflowLink(
                from_=wi("data_set"),
                to=n("load", "data_set"),
            ),
            WorkflowLink(
                from_=wi("factor"),
                to=n("calc", "factor"),
            ),
            WorkflowLink(
                from_=n("load", "data_set"),
                to=n("calc", "data_set"),
            ),
            WorkflowLink(
                from_=n("calc", "clean_factor"),
                to=n("mean_return_pooled", "clean_factor"),
            ),
            WorkflowLink(
                from_=n("calc", "clean_factor"),
                to=n("mean_return_bydate", "clean_factor"),
            ),
            WorkflowLink(
                from_=n("mean_return_pooled", "mean_return_by_quantile"),
                to=n("rate_ret", "returns"),
            ),
            WorkflowLink(
                from_=n("mean_return_bydate", "mean_return_by_quantile"),
                to=n("rate_ret_bydate", "returns"),
            ),
            WorkflowLink(
                from_=n("mean_return_bydate", "mean_return_by_quantile_std_error"),
                to=n("std_conv", "std"),
            ),
            WorkflowLink(
                from_=n("rate_ret_bydate", "rate_of_return"),
                to=n("spread", "mean_returns"),
            ),
            WorkflowLink(
                from_=n("rate_ret_bydate", "rate_of_return"),
                to=n("top_bottom_1d", "mean_returns_bydate"),
            ),
            WorkflowLink(
                from_=n("rate_ret_bydate", "rate_of_return"),
                to=n("top_bottom_5d", "mean_returns_bydate"),
            ),
            WorkflowLink(
                from_=n("rate_ret_bydate", "rate_of_return"),
                to=n("top_bottom_10d", "mean_returns_bydate"),
            ),
            WorkflowLink(
                from_=n("rate_ret_bydate", "rate_of_return"),
                to=n("top_bottom_20d", "mean_returns_bydate"),
            ),
            WorkflowLink(
                from_=n("std_conv", "std_converted"),
                to=n("spread", "std_err"),
            ),
            WorkflowLink(
                from_=n("calc", "clean_factor"),
                to=n("factor_cumret_1d", "clean_factor"),
            ),
            WorkflowLink(
                from_=n("rate_ret", "rate_of_return"),
                to=n("echarts_mean_q", "data"),
            ),
            WorkflowLink(
                from_=n("rate_ret_bydate", "rate_of_return"),
                to=n("echarts_bydate", "data"),
            ),
            WorkflowLink(
                from_=n("spread", "mean_return_spread"),
                to=n("echarts_spread", "data"),
            ),
            WorkflowLink(
                from_=n("factor_cumret_1d", "cumulative_returns"),
                to=n("echarts_cumret", "data"),
            ),
            WorkflowLink(
                from_=n("rate_ret_bydate", "rate_of_return"),
                to=n("cumret_by_quantile_1d", "mean_returns_bydate"),
            ),
            WorkflowLink(
                from_=n("cumret_by_quantile_1d", "cumulative_returns_by_quantile"),
                to=n("echarts_cumret_byq_1d", "data"),
            ),
            WorkflowLink(
                from_=n("top_bottom_1d", "spread_ts"),
                to=n("echarts_top_bottom_1d", "data"),
            ),
            WorkflowLink(
                from_=n("top_bottom_5d", "spread_ts"),
                to=n("echarts_top_bottom_5d", "data"),
            ),
            WorkflowLink(
                from_=n("top_bottom_10d", "spread_ts"),
                to=n("echarts_top_bottom_10d", "data"),
            ),
            WorkflowLink(
                from_=n("top_bottom_20d", "spread_ts"),
                to=n("echarts_top_bottom_20d", "data"),
            ),
            WorkflowLink(
                from_=n("echarts_mean_q", "option"),
                to=wo("result"),
            ),
            WorkflowLink(
                from_=n("echarts_bydate", "option"),
                to=wo("result"),
            ),
            WorkflowLink(
                from_=n("echarts_spread", "option"),
                to=wo("result"),
            ),
            WorkflowLink(
                from_=n("echarts_cumret", "option"),
                to=wo("result"),
            ),
        ],
    )
    return graph.serialize()
