"""Dynamically register workflow nodes from Factor subclasses (workspace registry)."""

from __future__ import annotations

from typing import Any

from evaluate import AlphalensFactorEvaluator
from factor import Factor, load_factor_class
from workflow import (
    BooleanNodeParam,
    NodeCatalog,
    NumberNodeParam,
    StringNodeParam,
    handler_from_node_class,
    workflow_node,
    workflow_node_type_key,
    workflow_socket,
)

from app.factors.registry import FactorItemsRegistry, read_source


def factor_class_to_workflow_node(factor_class: type[Factor], *, record_id: str) -> type:
    """Wrap ``factor_class`` with ``@workflow_node`` for Alphalens ``clean_factor`` output."""

    fc = factor_class
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in record_id)

    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        from evaluation_workflow_nodes.calculate_factor_value import (
            clean_factor_from_alphalens_evaluator,
        )

        resolver = kwargs["dependency_resolver"]
        inst = fc(dependency_resolver=resolver)
        ev = AlphalensFactorEvaluator(
            inst,
            start_date=kwargs.get("start_date"),
            end_date=str(kwargs["end_date"]),
            stock_codes=kwargs.get("stock_codes"),
            long_short=bool(kwargs.get("long_short", True)),
        )
        return (clean_factor_from_alphalens_evaluator(ev, dict(kwargs)),)

    cls_name = f"FactorWorkflowNode_{safe}"
    node_cls = type(cls_name, (), {"execute": execute, "__module__": __name__})
    label = str(getattr(factor_class, "label", factor_class.__name__))
    desc = str(getattr(factor_class, "description", ""))
    return workflow_node(
        label=f"{label} [{record_id}]",
        description=desc or f"工作区因子 {record_id}（Alphalens 清洗输出）",
        input_sockets=[
            workflow_socket("dependency_resolver", required=True, value_type="any"),
            workflow_socket("start_date", required=True, value_type="scalar_json"),
            workflow_socket("end_date", required=True, value_type="scalar_json"),
            workflow_socket("last_quantiles", required=True, value_type="scalar_json"),
            workflow_socket("stock_codes", required=False, value_type="scalar_json"),
        ],
        output_sockets=[workflow_socket("clean_factor", value_type="factor_data_clean")],
        workflow_parameters=[
            StringNodeParam(
                "forward_return_periods",
                label="持有期 periods（逗号分隔）",
                default="1,5,10,20",
            ),
            StringNodeParam(
                "alphalens_quantiles",
                label="分位数（留空则用环境变量 FACTOR_AGENT_QUANTILES，默认 5）",
                default="",
            ),
            BooleanNodeParam(
                "long_short",
                label="多空 long_short",
                default=True,
            ),
            NumberNodeParam(
                "max_loss",
                label="max_loss",
                default=0.5,
                minimum=0.0,
                maximum=10.0,
            ),
        ],
        entry="execute",
    )(node_cls)


def build_factor_workflow_node_catalog() -> NodeCatalog:
    """One workflow node per registered factor (loadable source)."""
    classes: dict[str, type] = {}
    for rec in FactorItemsRegistry.list_items():
        try:
            cls, _ = load_factor_class(read_source(rec))
        except ValueError:
            continue
        node_cls = factor_class_to_workflow_node(cls, record_id=rec.id)
        classes[workflow_node_type_key(node_cls)] = node_cls

    specs = {tid: cls.__node_spec__() for tid, cls in classes.items()}  # type: ignore[attr-defined]
    handlers = {tid: handler_from_node_class(cls) for tid, cls in classes.items()}
    return NodeCatalog(classes=dict(classes), specs=specs, handlers=handlers)
