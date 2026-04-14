from __future__ import annotations

from typing import Any

from app.strategy.constants import STRATEGY_WORKFLOW_INPUTS, STRATEGY_WORKFLOW_OUTPUTS


def example_topk_equal_weight_workflow_dict() -> dict[str, Any]:
    """
    A minimal, runnable built-in strategy workflow:
    DataSet -> Factor -> TopK -> EqualWeight -> Rebalance -> Lag -> BacktestInputs
    """

    return {
        "nodes": [
            {"id": "load", "type": "LoadDataSet", "pos": [0, 0], "params": {}},
            {
                "id": "factor",
                "type": "FactorRef",
                "pos": [300, 0],
                "params": {"factor_id": ""},
            },
            {
                "id": "rank",
                "type": "RankTopK",
                "pos": [600, 0],
                "params": {"k": 10, "ascending": False},
            },
            {"id": "ew", "type": "EqualWeight", "pos": [900, 0], "params": {}},
            {
                "id": "reb",
                "type": "Rebalance",
                "pos": [1200, 0],
                "params": {"freq": "W"},
            },
            {"id": "lag", "type": "Lag", "pos": [1500, 0], "params": {"bars": 1}},
            {"id": "out", "type": "ToBacktestInputs", "pos": [1800, 0], "params": {}},
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
                "from": {"kind": "node", "node_id": "load", "socket": "close"},
                "to": {"kind": "node", "node_id": "out", "socket": "close"},
            },
            {
                "from": {"kind": "node", "node_id": "lag", "socket": "weights"},
                "to": {"kind": "node", "node_id": "out", "socket": "weights"},
            },
            {
                "from": {"kind": "node", "node_id": "out", "socket": "backtest_inputs"},
                "to": {"kind": "workflow_output", "socket": "backtest_inputs"},
            },
        ],
        "workflow_inputs": STRATEGY_WORKFLOW_INPUTS,
        "workflow_outputs": STRATEGY_WORKFLOW_OUTPUTS,
    }
