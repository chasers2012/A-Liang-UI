from __future__ import annotations

import json
from typing import Any, Protocol

from workflow.schemas import WorkflowGraphPersisted
from workflow.validation import validate_required_workflow_fields

from app.infra.common.datetime_utils import utc_now_iso
from app.packages.nodes.controller import (
    list_nodes as list_workflow_nodes,
)
from app.packages.nodes.schemas import WorkflowNodeSummaryPublic
from app.infra.persistence.sqlite_db import get_session
from app.packages.strategy.constants import WORKFLOW_STRATEGY_DOMAIN, strategy_workflow_template_dict
from app.packages.strategy.models import StrategyRow
from app.packages.strategy.registry import StrategyRegistry
from app.packages.strategy.schemas import (
    StrategyCreate,
    StrategyListPublic,
    StrategyPatch,
    StrategyPublic,
    workflow_public_dict,
)


class StrategyWorkflowSpecLike(Protocol):
    id: str
    name: str
    description: str
    workflow: dict | None


def get_strategy_workflow_template() -> dict:
    return strategy_workflow_template_dict()


def register_plugin_strategy_workflow(workflow_spec: StrategyWorkflowSpecLike) -> None:
    strategy_id = str(workflow_spec.id).strip()
    if not strategy_id:
        raise ValueError("plugin strategy id cannot be empty")

    strategy_name = str(workflow_spec.name).strip()
    if not strategy_name:
        raise ValueError("plugin strategy name cannot be empty")

    raw_workflow = (
        workflow_spec.workflow
        if workflow_spec.workflow is not None
        else strategy_workflow_template_dict()
    )
    validated_workflow = WorkflowGraphPersisted.model_validate(raw_workflow).model_dump(
        by_alias=True
    )

    now = utc_now_iso()
    with get_session() as session:
        existed = session.get(StrategyRow, strategy_id)
        created_at = existed.created_at if existed is not None else now
        session.merge(
            StrategyRow(
                id=strategy_id,
                name=strategy_name,
                description=(workflow_spec.description or "").strip(),
                workflow=json.dumps(validated_workflow, ensure_ascii=False),
                created_at=created_at,
                updated_at=now,
            )
        )
        session.commit()


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
        row.workflow = json.dumps(body.workflow.model_dump(by_alias=True), ensure_ascii=False)
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
    validate_required_workflow_fields(body.workflow)
    row = body.to_row()
    StrategyRegistry.save(row)
    return to_strategy_public(row)


def patch_strategy(strategy_id: str, body: StrategyPatch) -> StrategyPublic | None:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        return None
    validate_required_workflow_fields(body.workflow)
    StrategyRegistry.save(merge_strategy_patch(row, body))
    return to_strategy_public(row)


def delete_strategy(strategy_id: str) -> bool:
    return StrategyRegistry.delete_by_id(strategy_id)


def to_strategy_public_dict(row: StrategyRow) -> dict[str, Any]:
    return to_strategy_public(row).model_dump()


def list_strategy_nodes() -> list[WorkflowNodeSummaryPublic]:
    return list_workflow_nodes(domain=WORKFLOW_STRATEGY_DOMAIN)
