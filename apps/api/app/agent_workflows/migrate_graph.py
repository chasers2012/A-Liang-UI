"""One-time migration: LiteGraph serialized JSON -> WorkflowGraph{nodes,links,viewport}.

The frontend has moved to ReactFlow and now expects a persisted graph shape compatible with
``lib/workflow/workflow/graph.py``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


def _num(x: Any, fallback: float = 0.0) -> float:
    try:
        v = float(x)
        return v if v == v else fallback  # NaN guard
    except Exception:
        return fallback


def _is_dict(x: Any) -> bool:
    return isinstance(x, dict)


def _is_list(x: Any) -> bool:
    return isinstance(x, list)


@dataclass
class MigrationResult:
    migrated: bool
    reason: str = ""


def _read_viewport(raw: dict[str, Any]) -> dict[str, float] | None:
    extra = raw.get("extra")
    if not isinstance(extra, dict):
        return None
    vp = extra.get("viewport")
    if not isinstance(vp, dict):
        return None
    return {
        "x": _num(vp.get("x", 0.0), 0.0),
        "y": _num(vp.get("y", 0.0), 0.0),
        "zoom": _num(vp.get("zoom", 1.0), 1.0),
    }


def _parse_nodes(
    nodes_raw: Any,
) -> tuple[list[dict[str, Any]], dict[int, str], dict[int, dict[str, list[str]]]]:
    out_nodes: list[dict[str, Any]] = []
    id_map: dict[int, str] = {}
    node_ios: dict[int, dict[str, list[str]]] = {}
    if not isinstance(nodes_raw, list):
        return out_nodes, id_map, node_ios

    for node in nodes_raw:
        if not isinstance(node, dict):
            continue
        props = node.get("properties")
        if not isinstance(props, dict):
            continue
        wid = props.get("workflowNodeId")
        backend_type = props.get("backendType")
        if not isinstance(wid, str) or not isinstance(backend_type, str):
            continue

        node_id = node.get("id")
        if isinstance(node_id, int):
            id_map[node_id] = wid

        pos = node.get("pos", [0, 0])
        px = _num(pos[0], 0.0) if isinstance(pos, list) and len(pos) > 0 else 0.0
        py = _num(pos[1], 0.0) if isinstance(pos, list) and len(pos) > 1 else 0.0

        if isinstance(node_id, int):
            inputs = node.get("inputs", [])
            outputs = node.get("outputs", [])
            node_ios[node_id] = {
                "inputs": [
                    str(slot.get("name", i))
                    for i, slot in enumerate(inputs)
                    if isinstance(slot, dict)
                ],
                "outputs": [
                    str(slot.get("name", i))
                    for i, slot in enumerate(outputs)
                    if isinstance(slot, dict)
                ],
            }

        params = props.get("params")
        out_nodes.append(
            {
                "id": wid,
                "type": backend_type,
                "pos": [px, py],
                "params": params if isinstance(params, dict) else {},
            }
        )

    return out_nodes, id_map, node_ios


def _slot_name(names: list[str], idx: int) -> str:
    return names[idx] if 0 <= idx < len(names) else str(idx)


def _parse_link_from_litegraph_tuple(
    link_item: list[Any],
    id_map: dict[int, str],
    node_ios: dict[int, dict[str, list[str]]],
) -> dict[str, Any] | None:
    if len(link_item) < 6:
        return None
    link_id = link_item[0]
    origin_id = link_item[2]
    origin_slot = link_item[3]
    target_id = link_item[4]
    target_slot = link_item[5]
    if not isinstance(origin_id, int) or not isinstance(target_id, int):
        return None

    from_node = id_map.get(origin_id)
    to_node = id_map.get(target_id)
    if not from_node or not to_node:
        return None

    oi = int(origin_slot) if isinstance(origin_slot, int) else int(_num(origin_slot, 0))
    ti = int(target_slot) if isinstance(target_slot, int) else int(_num(target_slot, 0))
    from_outputs = node_ios.get(origin_id, {}).get("outputs", [])
    to_inputs = node_ios.get(target_id, {}).get("inputs", [])

    return {
        "id": str(link_id) if link_id is not None else None,
        "from_node": from_node,
        "from_socket": _slot_name(from_outputs, oi),
        "to_node": to_node,
        "to_socket": _slot_name(to_inputs, ti),
    }


def _parse_links(
    links_raw: Any,
    id_map: dict[int, str],
    node_ios: dict[int, dict[str, list[str]]],
) -> list[dict[str, Any]]:
    out_links: list[dict[str, Any]] = []
    if not isinstance(links_raw, list):
        return out_links
    for link_item in links_raw:
        if isinstance(link_item, list):
            converted = _parse_link_from_litegraph_tuple(link_item, id_map, node_ios)
            if converted is not None:
                out_links.append(converted)
            continue
        if isinstance(link_item, dict) and "from_node" in link_item and "to_node" in link_item:
            out_links.append(link_item)
    return out_links


def is_new_workflow_graph_json(text: str) -> bool:
    """Heuristic: new schema has `links` as a list of dicts with `from_node` keys."""
    try:
        raw = json.loads(text)
    except Exception:
        return False
    if not isinstance(raw, dict):
        return False
    links = raw.get("links")
    if not isinstance(links, list):
        return False
    if len(links) == 0:
        # Empty graph is ambiguous; treat as new if it also has `viewport`.
        return "viewport" in raw
    first = links[0]
    return isinstance(first, dict) and "from_node" in first and "to_node" in first


def migrate_litegraph_to_workflow_graph_json(old_text: str) -> tuple[str, MigrationResult]:
    """Convert a LiteGraph `graph.serialize()` JSON string to the new persisted schema."""
    trimmed = (old_text or "").strip()
    if not trimmed:
        return (
            json.dumps({"nodes": [], "links": [], "viewport": None}, ensure_ascii=False),
            MigrationResult(migrated=True, reason="empty->empty"),
        )

    if is_new_workflow_graph_json(trimmed):
        return trimmed, MigrationResult(migrated=False, reason="already-new")

    try:
        raw = json.loads(trimmed)
    except Exception:
        # Keep original on parse failure.
        return trimmed, MigrationResult(migrated=False, reason="json-parse-failed")

    if not isinstance(raw, dict):
        return trimmed, MigrationResult(migrated=False, reason="not-object")

    out_nodes, id_map, node_ios = _parse_nodes(raw.get("nodes", []))
    out_links = _parse_links(raw.get("links", []), id_map, node_ios)
    viewport = _read_viewport(raw)

    new_graph = {"nodes": out_nodes, "links": out_links, "viewport": viewport}
    return (
        json.dumps(new_graph, ensure_ascii=False),
        MigrationResult(migrated=True, reason="migrated"),
    )
