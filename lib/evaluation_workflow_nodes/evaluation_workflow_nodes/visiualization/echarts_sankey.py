"""ECharts 桑基图节点（echartsy）。"""

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
    finalize_figure_option,
    merge_extra_and_pack,
    split_csv_fields,
)


@workflow_node(
    label="ECharts 桑基图",
    description="从 DataFrame 多列阶段与流量列生成桑基图（echartsy sankey）",
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
            "levels",
            required=True,
            default="",
            label="阶段列",
            description="逗号分隔，顺序为流向，至少两列，如 Source,Channel,Outcome",
        ),
        StringNodeParam(
            "value_field",
            required=True,
            default="value",
            label="流量列",
            description="连接粗细对应的数值列",
        ),
        OptionsNodeParam(
            "layout",
            required=False,
            default="none",
            label="布局",
            description="none 或 orthogonal",
            options=["none", "orthogonal"],
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
class EchartsSankeyNode:
    def execute(
        self,
        data: Any,
        levels: str = "",
        value_field: str = "value",
        layout: str = "none",
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_axes_scale_to_data: bool = True,
        value_decimal_places: int | float = 2,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        df = coerce_to_dataframe(data)
        lv = split_csv_fields(levels)
        if len(lv) < 2:
            raise ValueError("levels 至少需要两列（逗号分隔）")
        for c in lv:
            if c not in df.columns:
                raise KeyError(f"levels column {c!r} not found in dataframe columns")
        vf = value_field.strip()
        if not vf or vf not in df.columns:
            raise KeyError(f"value_field {vf!r} not found in dataframe columns")
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.sankey(df, levels=lv, value=vf, layout=layout)  # type: ignore[arg-type]
        option = finalize_figure_option(fig)
        return merge_extra_and_pack(
            option,
            extra_options,
            value_decimal_places=int(value_decimal_places),
            value_axes_scale_to_data=value_axes_scale_to_data,
        )
