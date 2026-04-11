"""ECharts 仪表盘节点（echartsy）。"""

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
)


@workflow_node(
    label="ECharts 仪表盘",
    description="从 DataFrame 单列取最后一行数值作为指针读数（echartsy gauge）",
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
            "value_field",
            required=True,
            default="value",
            label="数值列",
            description="取该列最后一个非空值作为指针",
        ),
        StringNodeParam(
            "gauge_name",
            required=False,
            default="",
            label="名称",
            description="表盘下方文字标签",
        ),
        NumberNodeParam(
            "min_val",
            required=False,
            default=0,
            label="最小值",
            description="量程下限",
        ),
        NumberNodeParam(
            "max_val",
            required=False,
            default=100,
            label="最大值",
            description="量程上限",
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
class EchartsGaugeNode:
    def execute(
        self,
        data: Any,
        value_field: str = "value",
        gauge_name: str = "",
        min_val: float = 0,
        max_val: float = 100,
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_axes_scale_to_data: bool = True,
        value_decimal_places: int | float = 2,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        df = coerce_to_dataframe(data)
        vf = value_field.strip()
        if not vf or vf not in df.columns:
            raise KeyError(f"value_field {vf!r} not found in dataframe columns")
        series = df[vf].dropna()
        if series.empty:
            raise ValueError("value_field has no non-null values")
        val = float(series.iloc[-1])
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.gauge(val, name=gauge_name.strip(), min_val=float(min_val), max_val=float(max_val))
        option = finalize_figure_option(fig)
        return merge_extra_and_pack(
            option,
            extra_options,
            value_decimal_places=int(value_decimal_places),
            value_axes_scale_to_data=value_axes_scale_to_data,
        )
