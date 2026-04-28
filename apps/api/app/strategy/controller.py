from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from workflow.schemas import (
    WorkflowGraphEndpointInput,
    WorkflowGraphEndpointNode,
    WorkflowGraphEndpointOutput,
    WorkflowGraphLink,
    WorkflowGraphNode,
    WorkflowGraphPersisted,
    WorkflowSocketDefinition,
)
from workflow.validation import validate_required_workflow_fields

from app.datasource.schemas import utc_now_iso
from app.nodes.controller import build_workflow_node_for_graph
from app.nodes.controller import list_nodes as list_workflow_nodes
from app.nodes.schemas import WorkflowNodeSummaryPublic
from app.strategy.constants import WORKFLOW_STRATEGY_DOMAIN, strategy_workflow_template_dict
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


def validate_strategy(strategy_id: str) -> StrategyValidateResponse | None:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        return None
    return validate_strategy_workflow_only(row.workflow)


def to_strategy_public_dict(row: StrategyRow) -> dict[str, Any]:
    return to_strategy_public(row).model_dump()


def list_strategy_nodes() -> list[WorkflowNodeSummaryPublic]:
    return list_workflow_nodes(domain=WORKFLOW_STRATEGY_DOMAIN)


def _validate_workflow(workflow: WorkflowGraphPersisted) -> WorkflowGraphPersisted:
    return WorkflowGraphPersisted.model_validate(workflow.model_dump(by_alias=True))


def _find_node_or_raise(workflow: WorkflowGraphPersisted, node_id: str) -> WorkflowGraphNode:
    node = next((item for item in workflow.nodes if item.id == node_id), None)
    if node is None:
        raise ValueError(f"节点不存在: {node_id}")
    return node


def _find_socket_or_raise(
    sockets: list[WorkflowSocketDefinition], socket_name: str, *, label: str
) -> WorkflowSocketDefinition:
    socket = next((item for item in sockets if item.name == socket_name), None)
    if socket is None:
        raise ValueError(f"{label}不存在: {socket_name}")
    return socket


def add_node(
    workflow: WorkflowGraphPersisted, node_type_id: str, **metadata: Any
) -> tuple[WorkflowGraphPersisted, str]:
    allowed_node_ids = {node.id for node in list_strategy_nodes()}
    if node_type_id not in allowed_node_ids:
        raise ValueError(f"节点类型不可用: {node_type_id}")

    node_id = str(metadata.pop("id", "")).strip() or str(uuid4())
    node_payload = build_workflow_node_for_graph(node_type_id, instance_id=node_id)
    if node_payload is None:
        raise ValueError(f"节点类型不存在: {node_type_id}")

    # only fields declared in WorkflowGraphNode are accepted as metadata overrides
    valid_fields = set(WorkflowGraphNode.model_fields.keys())
    for key, value in metadata.items():
        if key in valid_fields:
            node_payload[key] = value

    node = WorkflowGraphNode.model_validate(node_payload)
    new_workflow = workflow.model_copy(deep=True)
    new_workflow.nodes.append(node)
    return new_workflow, node.id


def remove_node(workflow: WorkflowGraphPersisted, node_id: str) -> WorkflowGraphPersisted:
    new_workflow = workflow.model_copy(deep=True)
    _find_node_or_raise(new_workflow, node_id)
    new_workflow.nodes = [node for node in new_workflow.nodes if node.id != node_id]
    new_workflow.links = [
        link
        for link in new_workflow.links
        if not (
            (link.from_.kind == "node" and link.from_.node_id == node_id)
            or (link.to.kind == "node" and link.to.node_id == node_id)
        )
    ]
    return _validate_workflow(new_workflow)


def update_node_metadata(
    workflow: WorkflowGraphPersisted, node_id: str, **metadata: Any
) -> WorkflowGraphPersisted:
    new_workflow = workflow.model_copy(deep=True)
    node = _find_node_or_raise(new_workflow, node_id)
    mutable_fields = {"label", "category", "pos", "inputs", "outputs", "params"}
    patch = {k: v for k, v in metadata.items() if k in mutable_fields}
    updated = WorkflowGraphNode.model_validate({**node.model_dump(), **patch})
    idx = next(i for i, item in enumerate(new_workflow.nodes) if item.id == node_id)
    new_workflow.nodes[idx] = updated
    return _validate_workflow(new_workflow)


def move_node(
    workflow: WorkflowGraphPersisted, node_id: str, pos: tuple[float, float] | list[float]
) -> WorkflowGraphPersisted:
    return update_node_metadata(workflow=workflow, node_id=node_id, pos=pos)


def set_node_param(
    workflow: WorkflowGraphPersisted, node_id: str, key: str, value: Any
) -> WorkflowGraphPersisted:
    new_workflow = workflow.model_copy(deep=True)
    node = _find_node_or_raise(new_workflow, node_id)
    params = dict(node.params or {})
    params[key] = value
    return update_node_metadata(new_workflow, node_id=node_id, params=params)


def unset_node_param(
    workflow: WorkflowGraphPersisted, node_id: str, key: str
) -> WorkflowGraphPersisted:
    new_workflow = workflow.model_copy(deep=True)
    node = _find_node_or_raise(new_workflow, node_id)
    params = dict(node.params or {})
    params.pop(key, None)
    return update_node_metadata(new_workflow, node_id=node_id, params=params)


def connect_nodes(
    workflow: WorkflowGraphPersisted,
    from_node_id: str,
    from_socket: str,
    to_node_id: str,
    to_socket: str,
) -> tuple[WorkflowGraphPersisted, str]:
    new_workflow = workflow.model_copy(deep=True)
    from_node = _find_node_or_raise(new_workflow, from_node_id)
    to_node = _find_node_or_raise(new_workflow, to_node_id)
    from_socket_def = _find_socket_or_raise(from_node.outputs, from_socket, label="输出 socket")
    to_socket_def = _find_socket_or_raise(to_node.inputs, to_socket, label="输入 socket")
    if from_socket_def.value_type != to_socket_def.value_type:
        raise ValueError(
            "socket value_type 不匹配: "
            f"{from_node_id}.{from_socket}={from_socket_def.value_type}, "
            f"{to_node_id}.{to_socket}={to_socket_def.value_type}"
        )
    link = WorkflowGraphLink(
        id=str(uuid4()),
        from_=WorkflowGraphEndpointNode(kind="node", node_id=from_node_id, socket=from_socket),
        to=WorkflowGraphEndpointNode(kind="node", node_id=to_node_id, socket=to_socket),
    )
    new_workflow.links.append(link)
    new_workflow = _validate_workflow(new_workflow)
    return new_workflow, str(link.id or "")


def connect_workflow_input(
    workflow: WorkflowGraphPersisted,
    input_socket: str,
    to_node_id: str,
    to_socket: str,
) -> tuple[WorkflowGraphPersisted, str]:
    new_workflow = workflow.model_copy(deep=True)
    workflow_input_def = _find_socket_or_raise(
        new_workflow.workflow_inputs, input_socket, label="工作流输入 socket"
    )
    to_node = _find_node_or_raise(new_workflow, to_node_id)
    to_socket_def = _find_socket_or_raise(to_node.inputs, to_socket, label="输入 socket")
    if workflow_input_def.value_type != to_socket_def.value_type:
        raise ValueError(
            "socket value_type 不匹配: "
            f"workflow_input.{input_socket}={workflow_input_def.value_type}, "
            f"{to_node_id}.{to_socket}={to_socket_def.value_type}"
        )
    link = WorkflowGraphLink(
        id=str(uuid4()),
        from_=WorkflowGraphEndpointInput(kind="workflow_input", socket=input_socket),
        to=WorkflowGraphEndpointNode(kind="node", node_id=to_node_id, socket=to_socket),
    )
    new_workflow.links.append(link)
    new_workflow = _validate_workflow(new_workflow)
    return new_workflow, str(link.id or "")


def connect_to_workflow_output(
    workflow: WorkflowGraphPersisted,
    from_node_id: str,
    from_socket: str,
    output_socket: str,
) -> tuple[WorkflowGraphPersisted, str]:
    new_workflow = workflow.model_copy(deep=True)
    from_node = _find_node_or_raise(new_workflow, from_node_id)
    from_socket_def = _find_socket_or_raise(from_node.outputs, from_socket, label="输出 socket")
    workflow_output_def = _find_socket_or_raise(
        new_workflow.workflow_outputs, output_socket, label="工作流输出 socket"
    )
    if from_socket_def.value_type != workflow_output_def.value_type:
        raise ValueError(
            "socket value_type 不匹配: "
            f"{from_node_id}.{from_socket}={from_socket_def.value_type}, "
            f"workflow_output.{output_socket}={workflow_output_def.value_type}"
        )
    link = WorkflowGraphLink(
        id=str(uuid4()),
        from_=WorkflowGraphEndpointNode(kind="node", node_id=from_node_id, socket=from_socket),
        to=WorkflowGraphEndpointOutput(kind="workflow_output", socket=output_socket),
    )
    new_workflow.links.append(link)
    new_workflow = _validate_workflow(new_workflow)
    return new_workflow, str(link.id or "")


def disconnect_link(workflow: WorkflowGraphPersisted, link_id: str) -> WorkflowGraphPersisted:
    new_workflow = workflow.model_copy(deep=True)
    filtered = [link for link in new_workflow.links if (link.id or "") != link_id]
    if len(filtered) == len(new_workflow.links):
        raise ValueError(f"连线不存在: {link_id}")
    new_workflow.links = filtered
    return _validate_workflow(new_workflow)


def disconnect_between(
    workflow: WorkflowGraphPersisted,
    from_node_id: str,
    from_socket: str,
    to_node_id: str,
    to_socket: str,
) -> WorkflowGraphPersisted:
    new_workflow = workflow.model_copy(deep=True)
    new_workflow.links = [
        link
        for link in new_workflow.links
        if not (
            link.from_.kind == "node"
            and link.from_.node_id == from_node_id
            and link.from_.socket == from_socket
            and link.to.kind == "node"
            and link.to.node_id == to_node_id
            and link.to.socket == to_socket
        )
    ]
    return _validate_workflow(new_workflow)
