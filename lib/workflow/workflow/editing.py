from __future__ import annotations

from collections.abc import Callable
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
from workflow.validation import (
    ensure_node_input_can_accept_link,
    ensure_socket_type_compatible,
    validate_workflow_graph,
)


def _validate_workflow(workflow: WorkflowGraphPersisted) -> WorkflowGraphPersisted:
    return validate_workflow_graph(workflow)


def _find_node_or_raise(workflow: WorkflowGraphPersisted, node_id: str) -> WorkflowGraphNode:
    node = next((item for item in workflow.nodes if item.id == node_id), None)
    if node is None:
        raise ValueError(f"节点不存在: {node_id}")
    return node


def _find_socket_or_raise(
    sockets: list[WorkflowSocketDefinition],
    socket_name: str,
    *,
    label: str,
    node_id: str | None = None,
    node_type: str | None = None,
) -> WorkflowSocketDefinition:
    socket = next((item for item in sockets if item.name == socket_name), None)
    if socket is None:
        names = [s.name for s in sockets if getattr(s, "name", None)]
        available = "、".join(names) if names else "（无）"
        if node_id is not None and node_type is not None:
            raise ValueError(
                f"节点 {node_id}（类型 {node_type}）不存在名为 {socket_name!r} 的{label}；"
                f"可用的{label}名称: {available}"
            )
        raise ValueError(f"{label}不存在: {socket_name}；可用的名称: {available}")
    return socket


def add_node(
    workflow: WorkflowGraphPersisted,
    node_type_id: str,
    *,
    build_node_payload: Callable[[str, str], dict[str, Any] | None],
    allowed_node_ids: set[str] | None = None,
    **metadata: Any,
) -> tuple[WorkflowGraphPersisted, str]:
    if allowed_node_ids is not None and node_type_id not in allowed_node_ids:
        raise ValueError(f"节点类型不可用: {node_type_id}")

    node_id = str(metadata.pop("id", "")).strip() or str(uuid4())
    node_payload = build_node_payload(node_type_id, node_id)
    if node_payload is None:
        raise ValueError(f"节点类型不存在: {node_type_id}")

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
    from_socket_def = _find_socket_or_raise(
        from_node.outputs,
        from_socket,
        label="输出 socket",
        node_id=from_node.id,
        node_type=from_node.type,
    )
    to_socket_def = _find_socket_or_raise(
        to_node.inputs,
        to_socket,
        label="输入 socket",
        node_id=to_node.id,
        node_type=to_node.type,
    )
    ensure_socket_type_compatible(
        from_socket_def.value_type,
        to_socket_def.value_type,
        from_label=f"{from_node_id}.{from_socket}",
        to_label=f"{to_node_id}.{to_socket}",
    )
    ensure_node_input_can_accept_link(new_workflow, to_node_id, to_socket, to_socket_def)
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
    ensure_socket_type_compatible(
        workflow_input_def.value_type,
        to_socket_def.value_type,
        from_label=f"workflow_input.{input_socket}",
        to_label=f"{to_node_id}.{to_socket}",
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
    ensure_socket_type_compatible(
        from_socket_def.value_type,
        workflow_output_def.value_type,
        from_label=f"{from_node_id}.{from_socket}",
        to_label=f"workflow_output.{output_socket}",
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
