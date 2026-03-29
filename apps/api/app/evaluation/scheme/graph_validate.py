"""Validate evaluation workflow graph (nodes, links, DAG)."""

from __future__ import annotations

from collections.abc import Set as AbstractSet

from workflow import WorkflowLink, WorkflowNode, assert_acyclic

from .profile_schemas import EvaluationWorkflow
from .workflow_graph_types import workflow_node_definition_or_fail


def _validate_unique_node_ids(nodes: list[WorkflowNode]) -> dict[str, WorkflowNode]:
    ids = [n.id for n in nodes]
    if len(ids) != len(set(ids)):
        raise ValueError("节点 id 重复")
    return {n.id: n for n in nodes}


def _validate_node_types(nodes: list[WorkflowNode], allowed_types: AbstractSet[str]) -> None:
    for n in nodes:
        t = n.type.strip()
        if not t:
            raise ValueError(f"节点 {n.id!r} 的 type 不能为空")
        if t not in allowed_types:
            raise ValueError(f"未知节点类型: {t!r}")


def _validate_link_endpoints(
    li: int,
    link: WorkflowLink,
    by_id: dict[str, WorkflowNode],
) -> None:
    if link.from_node not in by_id:
        raise ValueError(f"连线[{li}] from_node 不存在: {link.from_node!r}")
    if link.to_node not in by_id:
        raise ValueError(f"连线[{li}] to_node 不存在: {link.to_node!r}")
    if link.from_node == link.to_node:
        raise ValueError(f"连线[{li}] 不能自环")


def _validate_link_sockets(
    li: int,
    link: WorkflowLink,
    by_id: dict[str, WorkflowNode],
) -> None:
    ft = by_id[link.from_node].type
    tt = by_id[link.to_node].type
    fdef = workflow_node_definition_or_fail(ft)
    bout = {s.name for s in fdef.outputs}
    if link.from_socket not in bout:
        raise ValueError(f"连线[{li}] 源端口 {link.from_socket!r} 不是 {ft} 的输出")
    tdef = workflow_node_definition_or_fail(tt)
    binp = {s.name for s in tdef.inputs}
    if link.to_socket not in binp:
        raise ValueError(f"连线[{li}] 目标端口 {link.to_socket!r} 不是 {tt} 的输入")


def _validate_unique_link_targets(links: list[WorkflowLink]) -> None:
    """Each workflow input socket may have at most one incoming link (matches LiteGraph)."""
    seen: set[tuple[str, str]] = set()
    for li, link in enumerate(links):
        key = (link.to_node, link.to_socket)
        if key in seen:
            raise ValueError(
                f"连线[{li}] 与前面的连线冲突：节点 {link.to_node!r} 的输入端口 "
                f"{link.to_socket!r} 只能连接一条边"
            )
        seen.add(key)


def _validate_links(links: list[WorkflowLink], by_id: dict[str, WorkflowNode]) -> None:
    _validate_unique_link_targets(links)
    for li, link in enumerate(links):
        _validate_link_endpoints(li, link, by_id)
        _validate_link_sockets(li, link, by_id)


def validate_workflow_graph(
    workflow: EvaluationWorkflow,
    *,
    allowed_types: AbstractSet[str],
) -> None:
    """Validate DAG structure and sockets.

    Multiple nodes may share the same ``type`` (e.g. two ``metric:*`` nodes);
    node ``id`` values must remain unique.
    """
    nodes = workflow.nodes
    links = workflow.links
    by_id = _validate_unique_node_ids(nodes)
    _validate_node_types(nodes, allowed_types)
    for n in nodes:
        workflow_node_definition_or_fail(n.type)
    _validate_links(links, by_id)
    assert_acyclic(nodes, links)
