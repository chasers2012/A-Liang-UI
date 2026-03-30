"""Shared API response models for workflow node type definitions."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_serializer
from workflow import Node, Socket


class SocketSpecPublic(BaseModel):
    name: str
    required: bool = False
    value_type: str = "any"


class NodeTypeDefinitionPublic(BaseModel):
    type: str
    label: str
    description: str = ""
    inputs: list[SocketSpecPublic] = Field(default_factory=list)
    outputs: list[SocketSpecPublic] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)

    @model_serializer(mode="wrap")
    def _flatten_extra(self, handler: Any) -> dict[str, Any]:
        data = handler(self)
        ex = data.pop("extra", {})
        data.update(ex)
        return data


def node_spec_to_public(
    spec: Node,
    *,
    extra: dict[str, Any] | None = None,
) -> NodeTypeDefinitionPublic:
    """Convert a :class:`workflow.Node` to the API response model."""
    data = spec.serialize()
    return NodeTypeDefinitionPublic(
        type=str(data["type"]),
        label=str(data["label"]),
        description=str(data["description"]),
        inputs=[SocketSpecPublic.model_validate(s) for s in data["inputs"]],
        outputs=[SocketSpecPublic.model_validate(s) for s in data["outputs"]],
        extra=dict(extra) if extra else {},
    )


def socket_spec_to_public(spec: Socket) -> SocketSpecPublic:
    return SocketSpecPublic(name=spec.name, required=spec.required, value_type=spec.value_type)
