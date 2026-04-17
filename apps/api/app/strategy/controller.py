from __future__ import annotations

import json
from typing import Any

from app.datasource.schemas import utc_now_iso
from app.strategy.constants import strategy_workflow_template_dict
from app.strategy.models import StrategyRow
from app.strategy.registry import StrategyRegistry
from app.strategy.schemas import (
    StrategyCreate,
    StrategyListPublic,
    StrategyPatch,
    StrategyPublic,
    StrategyValidateResponse,
    workflow_public_dict,
)


def get_strategy_workflow_template() -> dict:
    return strategy_workflow_template_dict()


def validate_strategy_workflow_only(_: str) -> StrategyValidateResponse:
    # The full runtime validation (type-checking/graph execution) is implemented
    # together with the engine. For now, schemas already validate basic shape.
    return StrategyValidateResponse(ok=True, errors=[])


def to_strategy_public(row: StrategyRow) -> StrategyPublic:
    return StrategyPublic(
        id=row.id,
        name=row.name,
        description=row.description,
        workflow=workflow_public_dict(row.workflow),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def to_strategy_list_public(row: StrategyRow) -> StrategyListPublic:
    return StrategyListPublic(
        id=row.id,
        name=row.name,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def merge_strategy_patch(row: StrategyRow, body: StrategyPatch) -> StrategyRow:
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        row.name = str(body.name).strip() if body.name is not None else ""
    if "description" in data:
        row.description = (body.description or "").strip()
    if "workflow" in data and body.workflow is not None:
        row.workflow = json.dumps(body.workflow, ensure_ascii=False)
    row.updated_at = utc_now_iso()
    return row


def list_strategies() -> list[StrategyListPublic]:
    return [to_strategy_list_public(i) for i in StrategyRegistry.list_all()]


def get_strategy(strategy_id: str) -> StrategyPublic | None:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        return None
    return to_strategy_public(row)


def create_strategy(body: StrategyCreate) -> StrategyPublic:
    row = body.to_row()
    StrategyRegistry.save(row)
    return to_strategy_public(row)


def patch_strategy(strategy_id: str, body: StrategyPatch) -> StrategyPublic | None:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        return None
    StrategyRegistry.save(merge_strategy_patch(row, body))
    return to_strategy_public(row)


def delete_strategy(strategy_id: str) -> bool:
    return StrategyRegistry.delete_by_id(strategy_id)


def validate_strategy(strategy_id: str) -> StrategyValidateResponse | None:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        return None
    return validate_strategy_workflow_only(row.workflow)


def to_strategy_public_dict(row: StrategyRow) -> dict[str, Any]:
    return to_strategy_public(row).model_dump()
