"""Build and merge workflow node catalogs from decorated classes in modules."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from types import ModuleType

from .executor import NodeHandler, handler_from_node_class
from .node_decorator import collect_node_classes
from .node_spec import NodeSpec


@dataclass(frozen=True)
class NodeCatalog:
    """Maps ``WORKFLOW_TYPE_ID`` to class, :class:`NodeSpec`, and runtime :class:`NodeHandler`."""

    classes: dict[str, type]
    specs: dict[str, NodeSpec]
    handlers: dict[str, NodeHandler]


def build_node_catalog_from_modules(*modules: ModuleType) -> NodeCatalog:
    """Collect ``@workflow_node`` classes from each module or package and build maps."""
    classes: dict[str, type] = {}
    for m in modules:
        classes.update(collect_node_classes(m))
    specs = {tid: cls.__node_spec__() for tid, cls in classes.items()}  # type: ignore[attr-defined]
    handlers = {tid: handler_from_node_class(cls) for tid, cls in classes.items()}
    return NodeCatalog(classes=dict(classes), specs=specs, handlers=handlers)


def merge_node_catalogs(*catalogs: NodeCatalog) -> NodeCatalog:
    """Merge catalogs; later catalogs override earlier on duplicate ``WORKFLOW_TYPE_ID``."""
    classes: dict[str, type] = {}
    for c in catalogs:
        classes.update(c.classes)
    specs = {tid: cls.__node_spec__() for tid, cls in classes.items()}  # type: ignore[attr-defined]
    handlers = {tid: handler_from_node_class(cls) for tid, cls in classes.items()}
    return NodeCatalog(classes=dict(classes), specs=specs, handlers=handlers)


def ordered_specs(specs: Mapping[str, NodeSpec], type_ids: list[str]) -> list[NodeSpec]:
    """Return ``NodeSpec`` instances in ``type_ids`` order (must all exist)."""
    return [specs[tid] for tid in type_ids]
