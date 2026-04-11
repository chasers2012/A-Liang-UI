"""ECharts 漏斗图节点（echartsy）。"""

from __future__ import annotations

from typing import Any

import echartsy as ec
from workflow import (
    BooleanNodeParam,
    NodeParam,
    NumberNodeParam,
    OptionsNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)

from evaluation_workflow_nodes.visiualization.echarts_common import (
    apply_chrome,
    coerce_to_dataframe,
    ensure_y_columns,
    finalize_figure_option,
    merge_extra_and_pack,
    parse_y_field_list,
    prepare_dataframe_with_x,
)


@workflow_node(
    label="ECharts 漏斗图",
    description="从 DataFrame 生成漏斗图（阶段名称列 + 数值列，echartsy funnel）",
    category="factor_evaluation",
    input_sockets=[
        Socket(
            "data",
            required=True,
            value_type="dataframe",
            label="数据(DataFrame)",
            description="用于生成图表的数据源",
        ),
        StringNodeParam(
            "x_field",
            required=False,
            default="",
            label="阶段名称列",
            description="漏斗各阶段名称；为空时使用 DataFrame 索引",
        ),
        StringNodeParam(
            "y_fields",
            required=False,
            default="value",
            label="数值列",
            description="单个列名；若逗号分隔则仅使用第一列",
        ),
        OptionsNodeParam(
            "sort_order",
            required=False,
            default="descending",
            label="排序",
            description="阶段排序方式",
            options=["descending", "ascending", "none"],
        ),
        StringNodeParam("title", required=False, default="", label="标题", description="图表标题"),
        BooleanNodeParam(
            "show_legend",
            required=False,
            default=True,
            label="显示图例",
            description="是否显示 legend",
        ),
        BooleanNodeParam(
            "show_tooltip",
            required=False,
            default=True,
            label="显示提示",
            description="是否显示 tooltip",
        ),
        NumberNodeParam(
            "value_decimal_places",
            required=False,
            default=2,
            minimum=0,
            maximum=15,
            label="数值小数位数",
            description="图内数值（series、视觉映射等）保留的小数位；0 为整数",
        ),
        NodeParam(
            "extra_options",
            required=False,
            value_type="scalar_json",
            default=None,
            label="额外配置(将并入 option 根级)",
            description="与自动生成的 option 合并，冲突键以后者覆盖前者",
        ),
    ],
    output_sockets=[
        Socket(
            "option",
            value_type="scalar_json",
            label="ECharts 配置",
            description="包含 type=echart 与 option 的可视化配置对象\n\n**数据格式**\n- JSON 对象 `{'type':'echart','option':{...}}`",
        )
    ],
    entry="execute",
)
class EchartsFunnelNode:
    def execute(
        self,
        data: Any,
        x_field: str = "",
        y_fields: str = "value",
        sort_order: str = "descending",
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_decimal_places: int | float = 2,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        data = coerce_to_dataframe(data)
        y_list = parse_y_field_list(data, y_fields)
        if len(y_list) != 1:
            raise ValueError("漏斗图仅支持单个数值列（y_fields 只填一列）")
        ensure_y_columns(data, y_list)
        df, x_col = prepare_dataframe_with_x(data, x_field)
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.funnel(df, names=x_col, values=y_list[0], sort_order=sort_order)  # type: ignore[arg-type]
        option = finalize_figure_option(fig)
        return merge_extra_and_pack(
            option, extra_options, value_decimal_places=int(value_decimal_places)
        )
