"""Pydantic models for workflow graphs: nodes, links, viewport, and the graph container."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class WorkflowNode(BaseModel):
    id: str
    type: str
    pos: list[float] = Field(default_factory=lambda: [0.0, 0.0])
    params: dict[str, Any] = Field(default_factory=dict)

    @field_validator("pos")
    @classmethod
    def _two_floats(cls, v: list[float]) -> list[float]:
        if len(v) != 2:
            raise ValueError("pos must be [x, y]")
        return [float(v[0]), float(v[1])]


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
    nodes: list[WorkflowNode] = Field(default_factory=list)
    links: list[WorkflowLink] = Field(default_factory=list)
    viewport: WorkflowViewport | None = None
