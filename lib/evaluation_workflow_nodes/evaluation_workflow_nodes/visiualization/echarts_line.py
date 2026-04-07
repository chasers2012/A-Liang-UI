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


def _as_series_payload(
    data: pd.DataFrame,
    *,
    x_field: str,
    y_fields: list[str],
    smooth: bool,
    series_type: str,
) -> dict[str, Any]:
    if x_field == "__index__":
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
    return {"x_axis": x_values, "series": series}


def build_echarts_option(
    payload: dict[str, Any],
    *,
    title: str = "",
    x_axis_type: str = "category",
    show_legend: bool = True,
    show_tooltip: bool = True,
) -> dict[str, Any]:
    x_values = payload.get("x_axis", [])
    series = payload.get("series", [])
    y_axis = payload.get("y_axis")

    if not isinstance(series, list) or not series:
        raise ValueError("payload.series must be a non-empty list")

    option: dict[str, Any] = {
        "title": {"text": title or str(payload.get("title", ""))},
        "xAxis": {"type": x_axis_type, "data": _normalize_x_values(list(x_values))},
        "series": series,
    }

    if y_axis is None:
        option["yAxis"] = {"type": "value"}
    else:
        option["yAxis"] = y_axis

    if show_legend:
        option["legend"] = payload.get("legend", {})
    if show_tooltip:
        option["tooltip"] = payload.get("tooltip", {"trigger": "axis"})

    grid = payload.get("grid")
    if grid is not None:
        option["grid"] = grid
    return option


@workflow_node(
    label="ECharts Options",
    description="通用 ECharts option 构造节点（支持 dataframe 映射与标准化 payload 输入）",
    input_sockets=[
        Socket("data", required=False, value_type="dataframe", label="数据(DataFrame)"),
        Socket("payload", required=False, value_type="scalar_json", label="标准化图表数据"),
        StringNodeParam("series_name", required=False, default="", label="兼容旧参数: 单系列名称"),
        StringNodeParam("x_field", required=False, default="__index__", label="X 轴字段"),
        StringNodeParam("y_fields", required=False, default="value", label="Y 字段(逗号分隔)"),
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
        data: pd.DataFrame | None = None,
        payload: dict[str, Any] | list[dict[str, Any]] | None = None,
        series_name: str = "",
        x_field: str = "__index__",
        y_fields: str = "value",
        series_type: str = "line",
        title: str = "",
        x_axis_type: str = "category",
        smooth: bool = True,
        show_legend: bool = True,
        show_tooltip: bool = True,
        extra_options: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any] | list[dict[str, Any]]:
        _ = kwargs
        extra = extra_options or {}

        payload_items: list[dict[str, Any]]
        if payload is not None:
            payload_items = payload if isinstance(payload, list) else [payload]
        else:
            if data is None:
                raise ValueError("either payload or data is required")
            y_fields_value = series_name if series_name else y_fields
            y_field_list = [x.strip() for x in y_fields_value.split(",") if x.strip()]
            if not y_field_list:
                raise ValueError("y_fields must contain at least one field")
            payload_items = [
                _as_series_payload(
                    data,
                    x_field=x_field,
                    y_fields=y_field_list,
                    smooth=smooth,
                    series_type=series_type,
                )
            ]

        options: list[dict[str, Any]] = []
        for item in payload_items:
            option = build_echarts_option(
                item,
                title=title,
                x_axis_type=x_axis_type,
                show_legend=show_legend,
                show_tooltip=show_tooltip,
            )
            option.update(extra)
            options.append({"type": "echart", "option": option})
        return options if len(options) > 1 else options[0]
