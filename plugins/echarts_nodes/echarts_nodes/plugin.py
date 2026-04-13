from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from echarts_nodes import (
    EchartsBarNode,
    EchartsBoxplotNode,
    EchartsCalendarHeatmapNode,
    EchartsCandlestickNode,
    EchartsFunnelNode,
    EchartsGaugeNode,
    EchartsGraphNode,
    EchartsHeatmapNode,
    EchartsHistNode,
    EchartsKdeNode,
    EchartsLineNode,
    EchartsPieNode,
    EchartsRadarNode,
    EchartsSankeyNode,
    EchartsScatterNode,
    EchartsSunburstNode,
    EchartsTreemapNode,
    EchartsWaterfallNode,
)


class EchartsNodesPlugin(NodePlugin):
    name = "echarts"
    nodes: ClassVar[list[type]] = [
        EchartsBarNode,
        EchartsBoxplotNode,
        EchartsCalendarHeatmapNode,
        EchartsCandlestickNode,
        EchartsFunnelNode,
        EchartsGaugeNode,
        EchartsGraphNode,
        EchartsHeatmapNode,
        EchartsHistNode,
        EchartsKdeNode,
        EchartsLineNode,
        EchartsPieNode,
        EchartsRadarNode,
        EchartsSankeyNode,
        EchartsScatterNode,
        EchartsSunburstNode,
        EchartsTreemapNode,
        EchartsWaterfallNode,
    ]
