from __future__ import annotations

from workflow.parser import Parser

from app.backtest.engine.nodes import (
    EqualWeightNode,
    FactorRefNode,
    LagNode,
    LoadDataSetNode,
    RankTopKNode,
    RebalanceNode,
    ThresholdSignalNode,
    ToBacktestInputsNode,
)
from app.strategy.constants import strategy_workflow_io_spec_dict
from app.strategy.schemas import (
    StrategyNodeTypePublic,
    StrategyValidateResponse,
    WorkflowIOSpecPublic,
)


def list_strategy_node_types_public() -> list[StrategyNodeTypePublic]:
    node_defs = [
        ("LoadDataSet", LoadDataSetNode),
        ("FactorRef", FactorRefNode),
        ("ThresholdSignal", ThresholdSignalNode),
        ("RankTopK", RankTopKNode),
        ("EqualWeight", EqualWeightNode),
        ("Rebalance", RebalanceNode),
        ("Lag", LagNode),
        ("ToBacktestInputs", ToBacktestInputsNode),
    ]
    out: list[StrategyNodeTypePublic] = []
    for type_key, node_cls in node_defs:
        out.append(
            StrategyNodeTypePublic(
                type=type_key,
                label=getattr(node_cls, "label", type_key),
                description=getattr(node_cls, "description", "") or "",
                category=getattr(node_cls, "category", None),
                inputs=[Parser.serialize_socket(s) for s in node_cls.inputs],
                outputs=[Parser.serialize_socket(s) for s in node_cls.outputs],
            )
        )
    return out


def get_strategy_workflow_io_spec() -> WorkflowIOSpecPublic:
    return WorkflowIOSpecPublic(**strategy_workflow_io_spec_dict())


def validate_strategy_workflow_only(_: str) -> StrategyValidateResponse:
    # The full runtime validation (type-checking/graph execution) is implemented
    # together with the engine. For now, schemas already validate basic shape.
    return StrategyValidateResponse(ok=True, errors=[])
