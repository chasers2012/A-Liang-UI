from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from common_nodes.data_set_to_wide import DataSetToWideNode
from common_nodes.factor_ref import FactorRefNode
from common_nodes.json_nodes import JsonParseNode, JsonToDataframeNode, LongTextParamsNode
from common_nodes.lag_node import LagNode
from common_nodes.load_data_set import LoadDataSet
from common_nodes.mask_nodes import MaskAndNode, MaskNotNode, MaskOrNode, ThresholdMask
from common_nodes.param_input_nodes import (
    BooleanParamsNode,
    DateParamsNode,
    DateTimeParamsNode,
    NumberParamsNode,
    StringParamsNode,
)
from common_nodes.table_index_nodes import MultiIndexToWideNode, WideToMultiIndexNode


class CommonNodesPlugin(NodePlugin):
    name = "common"
    nodes: ClassVar[list[type]] = [
        LoadDataSet,
        DataSetToWideNode,
        FactorRefNode,
        NumberParamsNode,
        BooleanParamsNode,
        StringParamsNode,
        DateParamsNode,
        DateTimeParamsNode,
        JsonToDataframeNode,
        JsonParseNode,
        LongTextParamsNode,
        WideToMultiIndexNode,
        MultiIndexToWideNode,
        LagNode,
        ThresholdMask,
        MaskAndNode,
        MaskOrNode,
        MaskNotNode,
    ]
