"""Built-in evaluation metrics: stable ids, node-type helpers, and seed metadata."""

from __future__ import annotations

from dataclasses import dataclass

METRIC_NODE_TYPE_PREFIX = "metric:"


@dataclass(frozen=True)
class BuiltinSeedMeta:
    metric_id: str
    label: str
    description: str
    template_file: str
    visualization: dict | None = None


BUILTIN_SEED_METAS: tuple[BuiltinSeedMeta, ...] = (
    BuiltinSeedMeta(
        metric_id="builtin.mean_ic",
        label="平均 IC",
        description="各持有期平均信息系数（Alphalens）",
        template_file="mean_ic.py",
        visualization={"mode": "auto", "period_day_keys": True},
    ),
    BuiltinSeedMeta(
        metric_id="builtin.mean_return_spread",
        label="多空收益差",
        description="分位多空平均收益差（按持有期）",
        template_file="mean_return_spread.py",
        visualization={"mode": "auto", "period_day_keys": False},
    ),
)

BUILTIN_METRIC_IDS: frozenset[str] = frozenset(m.metric_id for m in BUILTIN_SEED_METAS)


def metric_node_type(metric_id: str) -> str:
    if ":" in metric_id:
        raise ValueError("metric_id 不得包含冒号")
    return f"{METRIC_NODE_TYPE_PREFIX}{metric_id}"


def parse_metric_node_type(node_type: str) -> str | None:
    if not node_type.startswith(METRIC_NODE_TYPE_PREFIX):
        return None
    mid = node_type[len(METRIC_NODE_TYPE_PREFIX) :].strip()
    return mid or None


def is_builtin_metric_id(metric_id: str) -> bool:
    return metric_id in BUILTIN_METRIC_IDS
