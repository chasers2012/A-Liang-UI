"""ECharts 瀑布图节点（echartsy）。"""

from __future__ import annotations

from typing import Any

import echartsy as ec
from workflow import (
    BooleanNodeParam,
    NodeParam,
    NumberNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)

from .echarts_common import (
    VALUE_DECIMAL_PLACES_DEFAULT,
    apply_chrome,
    coerce_to_dataframe,
    ensure_y_columns,
    finalize_figure_option,
    merge_extra_and_pack,
    parse_y_field_list,
    patch_x_axis_label_density,
    prepare_dataframe_with_x,
)


@workflow_node(
    label="ECharts 瀑布图",
    description="从 DataFrame 类目列与数值增量列生成瀑布图（echartsy waterfall）",
    category="ECharts",
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
            label="类目列",
            description="为空时使用 DataFrame 索引",
        ),
        StringNodeParam(
            "y_fields",
            required=False,
            default="value",
            label="数值列",
            description="各柱的增量；单个列名",
        ),
        BooleanNodeParam(
            "total",
            required=False,
            default=False,
            label="显示合计柱",
            description="是否在末尾追加合计",
        ),
        BooleanNodeParam(
            "connector",
            required=False,
            default=True,
            label="连接线",
            description="柱顶之间是否画虚线连接",
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
        BooleanNodeParam(
            "value_axes_scale_to_data",
            required=False,
            default=True,
            label="数值轴贴合数据",
            description="开启时为直角坐标系 value 轴设置 scale，刻度范围更贴数据；横向条形图作用于数值横轴。关闭则恢复 ECharts 默认刻度（常含 0）。无直角坐标轴的图表类型不受影响",
        ),
        NumberNodeParam(
            "value_decimal_places",
            required=False,
            default=VALUE_DECIMAL_PLACES_DEFAULT,
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
class EchartsWaterfallNode:
    def execute(
        self,
        data: Any,
        x_field: str = "",
        y_fields: str = "value",
        total: bool = False,
        connector: bool = True,
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_axes_scale_to_data: bool = True,
        value_decimal_places: int | float = VALUE_DECIMAL_PLACES_DEFAULT,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        df = coerce_to_dataframe(data)
        y_list = parse_y_field_list(df, y_fields)
        if len(y_list) != 1:
            raise ValueError("瀑布图仅支持单个数值列")
        ensure_y_columns(df, y_list)
        df2, x_col = prepare_dataframe_with_x(df, x_field)
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.waterfall(df2, x=x_col, y=y_list[0], total=total, connector=connector)
        option = finalize_figure_option(fig)
        patch_x_axis_label_density(option, num_categories=len(df2))
        return merge_extra_and_pack(
            option,
            extra_options,
            value_decimal_places=int(value_decimal_places),
            value_axes_scale_to_data=value_axes_scale_to_data,
        )
