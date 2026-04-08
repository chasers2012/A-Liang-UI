"""Generic ECharts option builder for line-style charts."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import (
    BooleanNodeParam,
    NodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)
from workflow.node_types import OptionsNodeParam


def _normalize_x_values(values: list[Any]) -> list[Any]:
    out: list[Any] = []
    for value in values:
        if hasattr(value, "isoformat"):
            out.append(value.isoformat())
            continue
        out.append(value)
    return out


def build_echarts_option(
    data: pd.DataFrame,
    *,
    x_field: str,
    y_fields: list[str],
    smooth: bool,
    series_type: str,
    title: str = "",
    x_axis_type: str = "category",
    show_legend: bool = True,
    show_tooltip: bool = True,
) -> dict[str, Any]:
    if not x_field.strip():
        x_values = _normalize_x_values(data.index.tolist())
    else:
        if x_field not in data.columns:
            raise KeyError(f"x_field {x_field!r} not found in dataframe columns")
        x_values = _normalize_x_values(data[x_field].tolist())

    series: list[dict[str, Any]] = []
    for y_field in y_fields:
        if y_field not in data.columns:
            raise KeyError(f"y_field {y_field!r} not found in dataframe columns")
        series.append(
            {
                "name": y_field,
                "type": series_type,
                "data": data[y_field].tolist(),
                "smooth": smooth,
            }
        )
    if not series:
        raise ValueError("payload.series must be a non-empty list")

    option: dict[str, Any] = {
        "title": {"text": title},
        "xAxis": {"type": x_axis_type, "data": x_values},
        "series": series,
        "yAxis": {"type": "value"},
    }
    if show_legend:
        option["legend"] = {}
    if show_tooltip:
        option["tooltip"] = {"trigger": "axis"}
    return option


@workflow_node(
    label="ECharts Options",
    description="通用 ECharts option 构造节点（从 DataFrame 映射 x/y 字段生成 option）",
    input_sockets=[
        Socket("data", required=True, value_type="dataframe", label="数据(DataFrame)"),
        StringNodeParam("x_field", required=False, default="", label="X 轴字段"),
        StringNodeParam(
            "y_fields",
            required=False,
            default="value",
            label="Y 字段(逗号分隔，* 表示全部列)",
        ),
        OptionsNodeParam(
            "series_type",
            required=False,
            default="line",
            label="序列类型",
            options=[
                "line",
                "bar",
                "scatter",
                "pie",
                "candlestick",
                "radar",
                "heatmap",
                "treemap",
                "boxplot",
                "graph",
                "sankey",
                "funnel",
                "gauge",
                "map",
            ],
        ),
        StringNodeParam("title", required=False, default="", label="标题"),
        StringNodeParam("x_axis_type", required=False, default="category", label="X 轴类型"),
        BooleanNodeParam("smooth", required=False, default=True, label="平滑曲线"),
        BooleanNodeParam("show_legend", required=False, default=True, label="显示图例"),
        BooleanNodeParam("show_tooltip", required=False, default=True, label="显示提示"),
        NodeParam(
            "extra_options",
            required=False,
            value_type="scalar_json",
            default=None,
            label="额外配置(将并入 option 根级)",
        ),
    ],
    output_sockets=[Socket("option", value_type="scalar_json")],
    entry="execute",
)
class EchartsLineNode:
    def execute(
        self,
        data: pd.DataFrame,
        x_field: str = "",
        y_fields: str = "value",
        series_type: str = "line",
        title: str = "",
        x_axis_type: str = "category",
        smooth: bool = True,
        show_legend: bool = True,
        show_tooltip: bool = True,
        extra_options: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        _ = kwargs
        extra = extra_options or {}

        if isinstance(data, pd.Series):
            data = data.to_frame(name="value")

        raw_y = y_fields.strip()
        if raw_y in ("*", "__all__"):
            y_field_list = [str(c) for c in data.columns]
        else:
            y_field_list = [x.strip() for x in y_fields.split(",") if x.strip()]
        if not y_field_list:
            raise ValueError("y_fields must contain at least one field (or use *)")
        option = build_echarts_option(
            data,
            x_field=x_field,
            y_fields=y_field_list,
            smooth=smooth,
            series_type=series_type,
            title=title,
            x_axis_type=x_axis_type,
            show_legend=show_legend,
            show_tooltip=show_tooltip,
        )
        option.update(extra)
        return {"type": "echart", "option": option}
