from __future__ import annotations

from typing import Any

from app.strategy.constants import STRATEGY_WORKFLOW_INPUTS, STRATEGY_WORKFLOW_OUTPUTS


def example_topk_equal_weight_workflow_dict() -> dict[str, Any]:
    """
    A minimal, runnable built-in strategy workflow:
    data_set(ID) -> LoadDataSet -> Factor -> TopK -> EqualWeight -> Rebalance -> Lag -> Position

    Contract:
    - workflow input `data_set`: DataSet ID (str)
    - workflow output `position`: MultiIndex(date, asset) DataFrame with `position` column
    """

    return {
        "nodes": [
            {
                "id": "load",
                "type": "strategy_nodes.nodes.LoadDataSetNode",
                "pos": [0, 0],
                "params": {},
            },
            {
                "id": "factor",
                "type": "strategy_nodes.nodes.FactorRefNode",
                "pos": [300, 0],
                "params": {"factor_id": ""},
            },
            {
                "id": "rank",
                "type": "strategy_nodes.nodes.RankTopKNode",
                "pos": [600, 0],
                "params": {"k": 10, "ascending": False},
            },
            {
                "id": "ew",
                "type": "strategy_nodes.nodes.EqualWeightNode",
                "pos": [900, 0],
                "params": {},
            },
            {
                "id": "reb",
                "type": "strategy_nodes.nodes.RebalanceNode",
                "pos": [1200, 0],
                "params": {"freq": "W"},
            },
            {
                "id": "lag",
                "type": "strategy_nodes.nodes.LagNode",
                "pos": [1500, 0],
                "params": {"bars": 1},
            },
            {
                "id": "out",
                "type": "strategy_nodes.nodes.ToPositionNode",
                "pos": [1800, 0],
                "params": {},
            },
        ],
        "links": [
            {
                "from": {"kind": "workflow_input", "socket": "data_set"},
                "to": {"kind": "node", "node_id": "load", "socket": "data_set"},
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
                "from": {"kind": "node", "node_id": "rank", "socket": "selected"},
                "to": {"kind": "node", "node_id": "ew", "socket": "selected"},
            },
            {
                "from": {"kind": "node", "node_id": "ew", "socket": "weights"},
                "to": {"kind": "node", "node_id": "reb", "socket": "weights"},
            },
            {
                "from": {"kind": "node", "node_id": "reb", "socket": "weights"},
                "to": {"kind": "node", "node_id": "lag", "socket": "weights"},
            },
            {
                "from": {"kind": "node", "node_id": "lag", "socket": "weights"},
                "to": {"kind": "node", "node_id": "out", "socket": "weights"},
            },
            {
                "from": {"kind": "node", "node_id": "out", "socket": "position"},
                "to": {"kind": "workflow_output", "socket": "position"},
            },
        ],
        "workflow_inputs": STRATEGY_WORKFLOW_INPUTS,
        "workflow_outputs": STRATEGY_WORKFLOW_OUTPUTS,
    }
