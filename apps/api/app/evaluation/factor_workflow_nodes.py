"""Dynamically register workflow nodes from Factor subclasses (workspace registry)."""

from __future__ import annotations

from factor import Factor, load_factor_class
from workflow import (
    NodeRegistry,
    build_node_registry_from_classes,
    workflow_node,
    workflow_node_type_key,
    workflow_socket,
)

from app.factors.registry import FactorItemsRegistry, read_source


def factor_class_to_workflow_node(factor_class: type[Factor], *, record_id: str) -> type:
    """Wrap ``factor_class`` with ``@workflow_node`` that outputs a ``Factor`` instance."""

    fc = factor_class
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in record_id)

    def execute(self) -> tuple[Factor, ...]:
        return fc

    cls_name = f"FactorWorkflowNode_{safe}"
    node_cls = type(cls_name, (), {"execute": execute, "__module__": __name__})
    label = str(getattr(factor_class, "label", factor_class.__name__))
    desc = str(getattr(factor_class, "description", ""))
    return workflow_node(
        label=f"{label} [{record_id}]",
        description=desc or f"工作区因子 {record_id}（返回 Factor 实例）",
        input_sockets=[],
        output_sockets=[workflow_socket("factor", value_type="any")],
        entry="execute",
    )(node_cls)


def build_factor_workflow_node_registry() -> NodeRegistry:
    """One workflow node per registered factor (loadable source)."""
    classes: dict[str, type] = {}
    for rec in FactorItemsRegistry.list_items():
        try:
            cls, _ = load_factor_class(read_source(rec))
        except ValueError:
            continue
        node_cls = factor_class_to_workflow_node(cls, record_id=rec.id)
        classes[workflow_node_type_key(node_cls)] = node_cls

    return build_node_registry_from_classes(classes)
