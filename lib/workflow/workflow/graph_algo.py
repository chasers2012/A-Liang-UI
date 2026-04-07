"""Pure graph algorithms operating on :class:`~workflow.node_types.Node` / :class:`WorkflowLink` sequences."""

from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Sequence

from .node_types import Node, WorkflowLink


def topological_order(
    nodes: Sequence[Node],
    links: Sequence[WorkflowLink],
) -> list[str]:
    """Return node ids in topological order.  Raises ``ValueError`` on cycle."""
    by_id = {n.id: n for n in nodes}
    adj: dict[str, list[str]] = defaultdict(list)
    indeg: dict[str, int] = dict.fromkeys(by_id, 0)
    for link in links:
        adj[link.from_node].append(link.to_node)
        indeg[link.to_node] += 1
    q = deque([nid for nid, d in indeg.items() if d == 0])
    out: list[str] = []
    while q:
        u = q.popleft()
        out.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(out) != len(by_id):
        raise ValueError("workflow graph contains a cycle")
    return out
