"""Generic DAG graph validation: structure, sockets, and acyclicity."""

from __future__ import annotations

from collections.abc import Mapping
from collections.abc import Set as AbstractSet

from .graph import WorkflowGraph, WorkflowLink
from .graph_algo import assert_acyclic
from .node_registry import RegisteredNode
from .node_types import Node


def _validate_unique_node_ids(nodes: list[Node]) -> dict[str, Node]:
    ids = [n.id for n in nodes]
    if len(ids) != len(set(ids)):
        raise ValueError("节点 id 重复")
    return {n.id: n for n in nodes}


def _validate_node_types(
    nodes: list[Node],
    specs: Mapping[str, Node],
) -> None:
    for n in nodes:
        t = n.type.strip()
        if not t:
            raise ValueError(f"节点 {n.id!r} 的 type 不能为空")
        if t not in specs:
            raise ValueError(f"未知节点类型: {t!r}")


def _validate_link_endpoints(
    li: int,
    link: WorkflowLink,
    by_id: dict[str, Node],
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
    by_id: dict[str, Node],
    specs: Mapping[str, Node],
) -> None:
    ft = by_id[link.from_node].type
    tt = by_id[link.to_node].type
    fdef = specs.get(ft)
    if fdef is None:
        raise ValueError(f"未知节点类型: {ft!r}")
    bout = {s.name for s in fdef.outputs}
    if link.from_socket not in bout:
        raise ValueError(f"连线[{li}] 源端口 {link.from_socket!r} 不是 {ft} 的输出")
    tdef = specs.get(tt)
    if tdef is None:
        raise ValueError(f"未知节点类型: {tt!r}")
    binp = {s.name for s in tdef.inputs}
    if link.to_socket not in binp:
        raise ValueError(f"连线[{li}] 目标端口 {link.to_socket!r} 不是 {tt} 的输入")


def _validate_unique_link_targets(links: list[WorkflowLink]) -> None:
    seen: set[tuple[str, str]] = set()
    for li, link in enumerate(links):
        key = (link.to_node, link.to_socket)
        if key in seen:
            raise ValueError(
                f"连线[{li}] 与前面的连线冲突：节点 {link.to_node!r} 的输入端口 "
                f"{link.to_socket!r} 只能连接一条边"
            )
        seen.add(key)


def _validate_links(
    links: list[WorkflowLink],
    by_id: dict[str, Node],
    specs: Mapping[str, Node],
) -> None:
    _validate_unique_link_targets(links)
    for li, link in enumerate(links):
        _validate_link_endpoints(li, link, by_id)
        _validate_link_sockets(li, link, by_id, specs)


def validate_workflow_graph(
    graph: WorkflowGraph,
    *,
    node_type_specs: Mapping[str, Node],
) -> None:
    """Validate DAG structure, socket wiring, and acyclicity.

    ``node_type_specs`` maps each allowed ``node.type`` string to its
    :class:`Node` so that socket names can be checked against the definition.
    """
    nodes = graph.nodes
    links = graph.links
    by_id = _validate_unique_node_ids(nodes)
    _validate_node_types(nodes, node_type_specs)
    _validate_links(links, by_id, node_type_specs)
    assert_acyclic(nodes, links)


def validate_workflow_graph_against_registry(
    graph: WorkflowGraph,
    registry: Mapping[str, RegisteredNode],
    *,
    allowed_types: AbstractSet[str] | None = None,
) -> None:
    """Validate graph using a ``type_id -> RegisteredNode`` map.

    For each graph node: ``type`` is trimmed; must be non-empty, present in
    *registry*, and (if *allowed_types* is set) in *allowed_types*. Then
    :func:`validate_workflow_graph` runs with definitions from the registry.
    """
    node_type_specs: dict[str, Node] = {}
    for n in graph.nodes:
        t = (n.type or "").strip()
        if not t:
            raise ValueError(f"节点 {n.id!r} 的 type 不能为空")
        if t not in registry:
            raise ValueError(f"未知节点类型: {t!r}")
        if allowed_types is not None and t not in allowed_types:
            raise ValueError(f"不允许的节点类型: {t!r}")
        node_type_specs[t] = registry[t].definition
    validate_workflow_graph(graph, node_type_specs=node_type_specs)
