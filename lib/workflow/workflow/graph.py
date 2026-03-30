"""Pydantic models for workflow graphs: nodes, links, viewport, and the graph container."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .node_types import Node


class WorkflowLink(BaseModel):
    id: str | None = None
    from_node: str
    from_socket: str
    to_node: str
    to_socket: str


class WorkflowViewport(BaseModel):
    x: float = 0.0
    y: float = 0.0
    zoom: float = 1.0


class WorkflowGraph(BaseModel):
    nodes: list[Node] = Field(default_factory=list)
    links: list[WorkflowLink] = Field(default_factory=list)
    viewport: WorkflowViewport | None = None
