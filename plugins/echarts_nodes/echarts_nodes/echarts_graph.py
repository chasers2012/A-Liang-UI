"""ECharts 关系图节点（echartsy）。"""

from __future__ import annotations

from typing import Any

import echartsy as ec
import pandas as pd
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
    finalize_figure_option,
    merge_extra_and_pack,
)


@workflow_node(
    label="ECharts 关系图",
    description="节点表 + 边列表 JSON（source/target）生成力导向/环形关系图（echartsy graph）",
    category="ECharts",
    input_sockets=[
        Socket(
            "data",
            required=True,
            value_type="dataframe",
            label="节点表(DataFrame)",
            description="至少包含节点名称列（默认可为 name）",
        ),
        NodeParam(
            "edges_json",
            required=True,
            value_type="scalar_json",
            default=None,
            label="边列表 JSON",
            description="数组，每项含 source、target；可选 value 等",
        ),
        StringNodeParam(
            "node_name_column",
            required=False,
            default="name",
            label="节点名称列",
            description="节点表中作为图例/标签的列名",
        ),
        StringNodeParam(
            "edge_source_key",
            required=False,
            default="source",
            label="边 source 字段",
            description="edges_json 中起点字段名",
        ),
        StringNodeParam(
            "edge_target_key",
            required=False,
            default="target",
            label="边 target 字段",
            description="edges_json 中终点字段名",
        ),
        OptionsNodeParam(
            "layout",
            required=False,
            default="force",
            label="布局",
            description="force 力导向 / circular 环形 / none",
            options=["force", "circular", "none"],
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
class EchartsGraphNode:
    def execute(
        self,
        data: Any,
        edges_json: list[dict[str, Any]] | None = None,
        node_name_column: str = "name",
        edge_source_key: str = "source",
        edge_target_key: str = "target",
        layout: str = "force",
        title: str = "",
        show_legend: bool = True,
        show_tooltip: bool = True,
        value_axes_scale_to_data: bool = True,
        value_decimal_places: int | float = VALUE_DECIMAL_PLACES_DEFAULT,
        extra_options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        nodes_df = coerce_to_dataframe(data)
        nc = node_name_column.strip() or "name"
        if nc not in nodes_df.columns:
            raise KeyError(f"node_name_column {nc!r} not found in dataframe columns")
        if not isinstance(edges_json, list) or not edges_json:
            raise ValueError("edges_json 必须为非空 JSON 数组")
        edges_df = pd.DataFrame(edges_json)
        sk, tk = edge_source_key.strip() or "source", edge_target_key.strip() or "target"
        if sk not in edges_df.columns or tk not in edges_df.columns:
            raise KeyError(f"edges must contain columns {sk!r} and {tk!r}")
        vk = "value" if "value" in edges_df.columns else None
        fig = ec.Figure()
        apply_chrome(fig, title, show_legend, show_tooltip)
        fig.graph(
            nodes_df,
            edges_df,
            source=sk,
            target=tk,
            value=vk,
            node_name=nc,
            layout=layout,  # type: ignore[arg-type]
        )
        option = finalize_figure_option(fig)
        return merge_extra_and_pack(
            option,
            extra_options,
            value_decimal_places=int(value_decimal_places),
            value_axes_scale_to_data=value_axes_scale_to_data,
        )
