"""Pydantic models for workflow graphs: nodes, links, viewport, and the graph container."""

from __future__ import annotations

from .node_types import Node


class WorkflowLink:
    id: str | None = None
    from_node: str
    from_socket: str
    to_node: str
    to_socket: str

    def serialize(self) -> dict:
        return {
            "id": self.id,
            "from_node": self.from_node,
            "from_socket": self.from_socket,
            "to_node": self.to_node,
            "to_socket": self.to_socket,
        }

    @staticmethod
    def parse(config_dict: dict) -> WorkflowLink:
        return WorkflowLink(
            id=config_dict.get("id"),
            from_node=config_dict.get("from_node", ""),
            from_socket=config_dict.get("from_socket", ""),
            to_node=config_dict.get("to_node", ""),
            to_socket=config_dict.get("to_socket", ""),
        )


class WorkflowViewport:
    x: float = 0.0
    y: float = 0.0
    zoom: float = 1.0

    def serialize(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "zoom": self.zoom,
        }

    @staticmethod
    def parse(config_dict: dict) -> WorkflowViewport:
        return WorkflowViewport(
            x=config_dict.get("x", 0.0),
            y=config_dict.get("y", 0.0),
            zoom=config_dict.get("zoom", 1.0),
        )


class WorkflowGraph:
    nodes: list[Node]
    links: list[WorkflowLink]
    viewport: WorkflowViewport | None

    def __init__(
        self,
        *,
        nodes: list[Node] | None = None,
        links: list[WorkflowLink] | None = None,
        viewport: WorkflowViewport | None = None,
    ) -> None:
        self.nodes = list(nodes or [])
        self.links = list(links or [])
        self.viewport = viewport

    def serialize(self) -> dict:
        return {
            "nodes": [node.serialize() for node in self.nodes],
            "links": [link.serialize() for link in self.links],
            "viewport": self.viewport.serialize() if self.viewport else None,
        }

    @staticmethod
    def parse(config_dict: dict) -> WorkflowGraph:
        nodes = [Node.parse(node_conf) for node_conf in config_dict.get("nodes", [])]
        links = [WorkflowLink.parse(link_conf) for link_conf in config_dict.get("links", [])]
        viewport = WorkflowViewport.parse(config_dict.get("viewport", {}))
        return WorkflowGraph(
            nodes=nodes,
            links=links,
            viewport=viewport,
        )
