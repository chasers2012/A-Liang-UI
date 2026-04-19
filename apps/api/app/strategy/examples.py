from __future__ import annotations

from typing import Any

from app.strategy.constants import STRATEGY_WORKFLOW_INPUTS, STRATEGY_WORKFLOW_OUTPUTS


def example_topk_equal_weight_workflow_dict() -> dict[str, Any]:
    """
    A minimal, runnable built-in strategy workflow using existing nodes:
    data_set -> LoadDataSet -> FactorRefNode -> RankTopKEqualWeightNode -> RebalanceNode -> position

    Contract:
    - workflow input `data_set`: DataSet ID (str)
    - workflow output `position`: MultiIndex(date, asset) DataFrame with `position` column
    """

    return {
        "nodes": [
            {
                "id": "load",
                "type": "common_nodes.load_data_set.LoadDataSet",
                "pos": [0, 0],
                "params": {},
            },
            {
                "id": "factor",
                "type": "common_nodes.factor_ref.FactorRefNode",
                "pos": [300, 0],
                "params": {"factor_id": ""},
            },
            {
                "id": "rank",
                "type": "strategy_nodes.nodes.RankTopKEqualWeightNode",
                "pos": [600, 0],
                "params": {"k": 10, "ascending": False},
            },
            {
                "id": "reb",
                "type": "strategy_nodes.nodes.RebalanceNode",
                "pos": [900, 0],
                "params": {"freq": 1},
            },
        ],
        "links": [
            {
                "from": {"kind": "workflow_input", "socket": "data_set"},
                "to": {"kind": "node", "node_id": "load", "socket": "data_set_id"},
            },
            {
                "from": {"kind": "node", "node_id": "load", "socket": "data_set"},
                "to": {"kind": "node", "node_id": "factor", "socket": "data_set"},
            },
            {
                "from": {"kind": "node", "node_id": "factor", "socket": "factor"},
                "to": {"kind": "node", "node_id": "rank", "socket": "factor"},
            },
            {
                "from": {"kind": "node", "node_id": "rank", "socket": "weights"},
                "to": {"kind": "node", "node_id": "reb", "socket": "weights"},
            },
            {
                "from": {"kind": "node", "node_id": "reb", "socket": "weights"},
                "to": {"kind": "workflow_output", "socket": "position"},
            },
        ],
        "workflow_inputs": STRATEGY_WORKFLOW_INPUTS,
        "workflow_outputs": STRATEGY_WORKFLOW_OUTPUTS,
    }
