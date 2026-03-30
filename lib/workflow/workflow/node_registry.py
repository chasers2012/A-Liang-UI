"""Build and merge workflow node registries from decorated classes in modules."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from types import ModuleType
from typing import TypeAlias

from .executor import NodeHandler, handler_from_node_class
from .node_decorator import collect_node_classes
from .node_types import Node


def _field_default(cls: type, name: str):
    return cls.model_fields[name].default  # type: ignore[attr-defined]


def workflow_node_definition_from_class(cls: type) -> Node:
    """Build a type-definition :class:`Node` from a ``@workflow_node``-decorated class."""
    return Node(
        type=_field_default(cls, "type"),
        label=_field_default(cls, "label"),
        description=_field_default(cls, "description"),
        entry=_field_default(cls, "entry"),
        inputs=_field_default(cls, "inputs"),
        outputs=_field_default(cls, "outputs"),
        parameters=_field_default(cls, "parameters"),
    )


@dataclass(frozen=True)
class RegisteredNode:
    """One workflow node type: definition (metadata) and runtime handler."""

    definition: Node
    handler: NodeHandler


NodeRegistry: TypeAlias = dict[str, RegisteredNode]


def build_node_registry_from_classes(classes: dict[str, type]) -> NodeRegistry:
    """Collect ``@workflow_node`` classes and build ``type_id -> RegisteredNode``."""
    out: NodeRegistry = {}
    for tid, cls in classes.items():
        definition = workflow_node_definition_from_class(cls)
        out[tid] = RegisteredNode(
            definition=definition,
            handler=handler_from_node_class(cls, definition),
        )
    return out


def build_node_registry_from_modules(*modules: ModuleType) -> NodeRegistry:
    """Collect ``@workflow_node`` classes from each module or package and build registry."""
    classes: dict[str, type] = {}
    for m in modules:
        classes.update(collect_node_classes(m))
    return build_node_registry_from_classes(classes)


def merge_node_registries(*registries: Mapping[str, RegisteredNode]) -> NodeRegistry:
    """Merge registries; later registries override earlier on duplicate node type keys."""
    out: NodeRegistry = {}
    for r in registries:
        out.update(dict(r))
    return out


def ordered_definitions(registry: Mapping[str, RegisteredNode], type_ids: list[str]) -> list[Node]:
    """Return type-definition :class:`Node` instances in ``type_ids`` order (must all exist)."""
    return [registry[tid].definition for tid in type_ids]
