"""ECharts 箱线图节点（echartsy）。"""

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

from .echarts_common import (
    VALUE_DECIMAL_PLACES_DEFAULT,
    apply_chrome,
    coerce_to_dataframe,
    ensure_y_columns,
    finalize_figure_option,
    merge_extra_and_pack,
    parse_y_field_list,
    patch_x_axis_label_density,
)


@workflow_node(
    label="ECharts 箱线图",
    description="从 DataFrame 生成分组箱线图（分类列 + 数值列，echartsy boxplot）",
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
            required=True,
            default="",
            label="分类列",
            description="箱线图分组维度列名",
        ),
        StringNodeParam(
            "y_fields",
            required=False,
            default="value",
            label="数值列",
            description="单个列名；若逗号分隔则仅使用第一列",
        ),
        OptionsNodeParam(
            "orient",
            required=False,
            default="v",
            label="方向",
            description="v 纵向 / h 横向",
            options=["v", "h"],
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
class EchartsBoxplotNode:
    def execute(
        self,
        data: Any,
        x_field: str = "",
        y_fields: str = "value",
        orient: str = "v",
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_axes_scale_to_data: bool = True,
        value_decimal_places: int | float = VALUE_DECIMAL_PLACES_DEFAULT,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        df = coerce_to_dataframe(data)
        xc = x_field.strip()
        if not xc or xc not in df.columns:
            raise KeyError(f"x_field {xc!r} not found in dataframe columns")
        y_list = parse_y_field_list(df, y_fields)
        if len(y_list) != 1:
            raise ValueError("箱线图仅支持单个数值列（y_fields 只填一列）")
        ensure_y_columns(df, y_list)
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.boxplot(df, x=xc, y=y_list[0], orient=orient)  # type: ignore[arg-type]
        option = finalize_figure_option(fig)
        n = int(df[xc].nunique(dropna=False))
        patch_x_axis_label_density(option, num_categories=max(n, 1))
        return merge_extra_and_pack(
            option,
            extra_options,
            value_decimal_places=int(value_decimal_places),
            value_axes_scale_to_data=value_axes_scale_to_data,
        )
