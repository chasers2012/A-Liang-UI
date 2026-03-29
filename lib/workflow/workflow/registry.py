"""Protocol for domain-specific node type registries."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol, runtime_checkable

from .node_spec import NodeSpec


@runtime_checkable
class NodeTypeRegistry(Protocol):
    """Minimal interface every domain node-type catalog should satisfy."""

    def get(self, node_type: str) -> NodeSpec | None:
        """Return the spec for ``node_type``, or ``None`` if unknown."""
        ...

    def all_type_ids(self) -> frozenset[str]:
        """Return all known type id strings."""
        ...

    def all_specs(self) -> Mapping[str, NodeSpec]:
        """Return the full ``{type_id: NodeSpec}`` mapping."""
        ...
