from __future__ import annotations

from typing import Any

from workflow.schemas import (
    WorkflowBoundaryPositions,
    WorkflowGraphEndpointInput,
    WorkflowGraphEndpointNode,
    WorkflowGraphEndpointOutput,
    WorkflowGraphLink,
    WorkflowGraphNode,
    WorkflowGraphPersisted,
)

from app.strategy.constants import STRATEGY_WORKFLOW_INPUTS, STRATEGY_WORKFLOW_OUTPUTS


def example_topk_equal_weight_workflow_dict() -> dict[str, Any]:
    """
    A minimal, runnable built-in strategy workflow using existing nodes:
    data_set -> FactorRefNode -> RankTopKEqualWeightNode -> RebalanceNode
    -> ThresholdMask -> Lag -> MaskNot/MaskAnd -> entries/exits

    Contract:
    - workflow input `data_set`: DataSet object
    - workflow output `entries`/`exits`: price-shaped boolean DataFrames
    """

    wf = WorkflowGraphPersisted(
        nodes=[
            WorkflowGraphNode(
                id="factor",
                type="common_nodes.factor_ref.FactorRefNode",
                pos=(300, 0),
                label="Factor Reference",
                params={"factor_id": ""},
            ),
            WorkflowGraphNode(
                id="rank",
                type="strategy_nodes.nodes.RankTopKEqualWeightNode",
                pos=(600, 0),
                label="Rank TopK Equal Weight",
                params={"k": 10, "ascending": False},
            ),
            WorkflowGraphNode(
                id="reb",
                type="strategy_nodes.nodes.RebalanceNode",
                pos=(900, 0),
                label="Rebalance",
                params={"freq": 1},
            ),
            WorkflowGraphNode(
                id="mask",
                type="common_nodes.mask_nodes.ThresholdMask",
                pos=(1200, 0),
                label="Weights > 0 Mask",
                params={"threshold": 0.0, "operator": "gt"},
            ),
            WorkflowGraphNode(
                id="lag",
                type="common_nodes.lag_node.LagNode",
                pos=(1500, 0),
                label="Lag(1)",
                params={"bars": 1},
            ),
            WorkflowGraphNode(
                id="not_prev",
                type="common_nodes.mask_nodes.MaskNotNode",
                pos=(1800, -120),
                label="NOT Prev",
                params={},
            ),
            WorkflowGraphNode(
                id="not_cur",
                type="common_nodes.mask_nodes.MaskNotNode",
                pos=(1800, 120),
                label="NOT Cur",
                params={},
            ),
            WorkflowGraphNode(
                id="entries",
                type="common_nodes.mask_nodes.MaskAndNode",
                pos=(2100, -120),
                label="Entries",
                params={},
            ),
            WorkflowGraphNode(
                id="exits",
                type="common_nodes.mask_nodes.MaskAndNode",
                pos=(2100, 120),
                label="Exits",
                params={},
            ),
        ],
        links=[
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointInput(kind="workflow_input", socket="data_set"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="factor", socket="data_set"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="factor", socket="factor"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="rank", socket="factor"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="rank", socket="weights"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="reb", socket="weights"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="reb", socket="weights"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="mask", socket="input"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="mask", socket="mask"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="lag", socket="table"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="lag", socket="out"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="not_prev", socket="mask"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="mask", socket="mask"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="not_cur", socket="mask"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="mask", socket="mask"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="entries", socket="left"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="not_prev", socket="out"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="entries", socket="right"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="lag", socket="out"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="exits", socket="left"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="not_cur", socket="out"),
                to=WorkflowGraphEndpointNode(kind="node", node_id="exits", socket="right"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="entries", socket="out"),
                to=WorkflowGraphEndpointOutput(kind="workflow_output", socket="entries"),
            ),
            WorkflowGraphLink(
                from_=WorkflowGraphEndpointNode(kind="node", node_id="exits", socket="out"),
                to=WorkflowGraphEndpointOutput(kind="workflow_output", socket="exits"),
            ),
        ],
        workflow_inputs=STRATEGY_WORKFLOW_INPUTS,
        workflow_outputs=STRATEGY_WORKFLOW_OUTPUTS,
        workflow_boundary_positions=WorkflowBoundaryPositions(input=(-300, 0), output=(2400, 0)),
    )

    return wf.model_dump(by_alias=True)
