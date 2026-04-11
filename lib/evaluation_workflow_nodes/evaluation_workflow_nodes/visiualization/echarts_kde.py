"""ECharts 核密度曲线节点（echartsy）。"""

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

from evaluation_workflow_nodes.visiualization.echarts_common import (
    apply_chrome,
    coerce_to_dataframe,
    finalize_figure_option,
    merge_extra_and_pack,
    patch_x_axis_label_density,
)


@workflow_node(
    label="ECharts KDE 曲线",
    description="从 DataFrame 数值列生成核密度估计曲线（echartsy kde，可选 hue 分组）",
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
            "column",
            required=True,
            default="value",
            label="数值列",
            description="估计密度的目标列",
        ),
        StringNodeParam(
            "hue_field",
            required=False,
            default="",
            label="分组列",
            description="可选；按该列分组绘制多条 KDE",
        ),
        BooleanNodeParam(
            "area",
            required=False,
            default=False,
            label="填充面积",
            description="曲线下方是否填充",
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
class EchartsKdeNode:
    def execute(
        self,
        data: Any,
        column: str = "value",
        hue_field: str = "",
        area: bool = False,
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_decimal_places: int | float = 2,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        df = coerce_to_dataframe(data)
        col = column.strip()
        if not col or col not in df.columns:
            raise KeyError(f"column {col!r} not found in dataframe columns")
        hf = hue_field.strip()
        if hf and hf not in df.columns:
            raise KeyError(f"hue_field {hf!r} not found in dataframe columns")
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        if hf:
            fig.kde(df, column=col, hue=hf, area=area)
        else:
            fig.kde(df, column=col, area=area)
        option = finalize_figure_option(fig)
        xd = option.get("xAxis")
        n = 0
        if isinstance(xd, dict) and isinstance(xd.get("data"), list):
            n = len(xd["data"])
        patch_x_axis_label_density(option, num_categories=max(n, 32))
        return merge_extra_and_pack(
            option, extra_options, value_decimal_places=int(value_decimal_places)
        )
