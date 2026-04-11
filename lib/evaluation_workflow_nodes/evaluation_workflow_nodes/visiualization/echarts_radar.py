"""ECharts 雷达图节点（echartsy）。"""

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
    split_csv_fields,
)


@workflow_node(
    label="ECharts 雷达图",
    description="宽表：每行一个系列，指定多列为雷达轴指标（echartsy radar）",
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
            "metric_columns",
            required=True,
            default="",
            label="指标列",
            description="逗号分隔的数值列名，顺序即雷达各轴",
        ),
        StringNodeParam(
            "series_label_column",
            required=False,
            default="",
            label="系列名称列",
            description="可选；为空则使用 DataFrame 索引字符串",
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
class EchartsRadarNode:
    def execute(
        self,
        data: Any,
        metric_columns: str = "",
        series_label_column: str = "",
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_axes_scale_to_data: bool = True,
        value_decimal_places: int | float = 2,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        df = coerce_to_dataframe(data)
        metrics = split_csv_fields(metric_columns)
        if len(metrics) < 2:
            raise ValueError("metric_columns 至少需要两个指标列")
        for m in metrics:
            if m not in df.columns:
                raise KeyError(f"metric column {m!r} not found in dataframe columns")
        slab = series_label_column.strip()
        if slab:
            if slab not in df.columns:
                raise KeyError(f"series_label_column {slab!r} not found")
            if slab in metrics:
                raise ValueError("series_label_column 不能与指标列重名")
            names = df[slab].astype(str).tolist()
        else:
            names = [str(i) for i in df.index]
        sub = df[metrics].astype(float)
        indicators: list[dict[str, Any]] = []
        for m in metrics:
            mx = float(sub[m].max())
            pad = mx * 0.05 if mx != 0 else 1.0
            indicators.append({"name": m, "max": mx + pad})
        rows = sub.values.tolist()
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.radar(indicators, rows, series_names=names)
        option = finalize_figure_option(fig)
        return merge_extra_and_pack(
            option,
            extra_options,
            value_decimal_places=int(value_decimal_places),
            value_axes_scale_to_data=value_axes_scale_to_data,
        )
