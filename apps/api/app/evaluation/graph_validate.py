"""Validate evaluation workflow graph (nodes, links, DAG)."""

from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Set as AbstractSet

from app.evaluation.node_type_registry import builtin_node_definition, is_builtin_type
from app.evaluation.profile_schemas import EvaluationWorkflow


def validate_workflow_graph(  # noqa: C901
    workflow: EvaluationWorkflow,
    *,
    allowed_types: AbstractSet[str],
) -> None:
    nodes = workflow.nodes
    links = workflow.links

    ids = [n.id for n in nodes]
    if len(ids) != len(set(ids)):
        raise ValueError("节点 id 重复")

    by_id = {n.id: n for n in nodes}
    for n in nodes:
        t = n.type.strip()
        if not t:
            raise ValueError(f"节点 {n.id!r} 的 type 不能为空")
        if t not in allowed_types:
            raise ValueError(f"未知节点类型: {t!r}")

    for li, link in enumerate(links):
        if link.from_node not in by_id:
            raise ValueError(f"连线[{li}] from_node 不存在: {link.from_node!r}")
        if link.to_node not in by_id:
            raise ValueError(f"连线[{li}] to_node 不存在: {link.to_node!r}")
        if link.from_node == link.to_node:
            raise ValueError(f"连线[{li}] 不能自环")

        ft = by_id[link.from_node].type
        tt = by_id[link.to_node].type
        if is_builtin_type(ft):
            bout = {s.name for s in builtin_node_definition(ft).outputs}
            if link.from_socket not in bout:
                raise ValueError(f"连线[{li}] 源端口 {link.from_socket!r} 不是 {ft} 的输出")
        if is_builtin_type(tt):
            binp = {s.name for s in builtin_node_definition(tt).inputs}
            if link.to_socket not in binp:
                raise ValueError(f"连线[{li}] 目标端口 {link.to_socket!r} 不是 {tt} 的输入")

    adj: dict[str, list[str]] = defaultdict(list)
    indeg: dict[str, int] = dict.fromkeys(by_id, 0)
    for link in links:
        adj[link.from_node].append(link.to_node)
        indeg[link.to_node] += 1

    q = deque([nid for nid, d in indeg.items() if d == 0])
    seen = 0
    while q:
        u = q.popleft()
        seen += 1
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)

    if nodes and seen != len(by_id):
        raise ValueError("工作流存在环路")
