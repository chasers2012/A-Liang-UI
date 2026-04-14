from __future__ import annotations

from app.strategy.constants import strategy_workflow_io_spec_dict
from app.strategy.schemas import (
    StrategyValidateResponse,
    WorkflowIOSpecPublic,
)


def get_strategy_workflow_io_spec() -> WorkflowIOSpecPublic:
    return WorkflowIOSpecPublic(**strategy_workflow_io_spec_dict())


def validate_strategy_workflow_only(_: str) -> StrategyValidateResponse:
    # The full runtime validation (type-checking/graph execution) is implemented
    # together with the engine. For now, schemas already validate basic shape.
    return StrategyValidateResponse(ok=True, errors=[])
