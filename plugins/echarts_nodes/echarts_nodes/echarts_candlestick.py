"""ECharts K 线图节点（echartsy）。"""

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
    finalize_figure_option,
    merge_extra_and_pack,
    patch_x_axis_label_density,
)


@workflow_node(
    label="ECharts K 线图",
    description="从 DataFrame OHLC 列生成蜡烛图（echartsy candlestick）",
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
            "date_field",
            required=True,
            default="",
            label="时间/类目列",
            description="横轴标签列（如 Date）",
        ),
        StringNodeParam(
            "open_field",
            required=True,
            default="open",
            label="开盘价列",
            description="列名",
        ),
        StringNodeParam(
            "close_field",
            required=True,
            default="close",
            label="收盘价列",
            description="列名",
        ),
        StringNodeParam(
            "low_field",
            required=True,
            default="low",
            label="最低价列",
            description="列名",
        ),
        StringNodeParam(
            "high_field",
            required=True,
            default="high",
            label="最高价列",
            description="列名",
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
class EchartsCandlestickNode:
    def execute(
        self,
        data: Any,
        date_field: str = "",
        open_field: str = "open",
        close_field: str = "close",
        low_field: str = "low",
        high_field: str = "high",
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_axes_scale_to_data: bool = True,
        value_decimal_places: int | float = VALUE_DECIMAL_PLACES_DEFAULT,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        df = coerce_to_dataframe(data)
        dcol = date_field.strip()
        o, c, lo, hi = (
            open_field.strip(),
            close_field.strip(),
            low_field.strip(),
            high_field.strip(),
        )
        if not dcol:
            raise ValueError("date_field must be non-empty")
        for name, col in (
            ("date_field", dcol),
            ("open_field", o),
            ("close_field", c),
            ("low_field", lo),
            ("high_field", hi),
        ):
            if col not in df.columns:
                raise KeyError(f"{name} column {col!r} not found in dataframe columns")
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.candlestick(df, date=dcol, open=o, close=c, low=lo, high=hi)
        option = finalize_figure_option(fig)
        patch_x_axis_label_density(option, num_categories=len(df))
        return merge_extra_and_pack(
            option,
            extra_options,
            value_decimal_places=int(value_decimal_places),
            value_axes_scale_to_data=value_axes_scale_to_data,
        )
