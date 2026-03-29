"""Dataclasses describing a workflow node type's sockets and metadata."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SocketSpec:
    name: str
    required: bool = False
    value_type: str = "any"


@dataclass(frozen=True)
class NodeSpec:
    type: str
    label: str
    description: str
    inputs: tuple[SocketSpec, ...]
    outputs: tuple[SocketSpec, ...]
