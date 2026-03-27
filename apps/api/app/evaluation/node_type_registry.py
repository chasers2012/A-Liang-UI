"""Static prepare node + viz nodes; metric nodes use metric:<id> (see workflow_graph_types)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SocketSpec:
    name: str
    required: bool = False
    value_type: str = "any"


@dataclass(frozen=True)
class BuiltinNodeSpec:
    type: str
    label: str
    description: str
    inputs: tuple[SocketSpec, ...]
    outputs: tuple[SocketSpec, ...]


VIZ_NODE_TYPE_PREFIX = "viz_"

_VIZ_NODE_META: tuple[tuple[str, str, str], ...] = (
    (
        "viz_auto",
        "可视化·自动",
        "按数值是否含负自动选条形样式；仅透传数据",
    ),
    (
        "viz_bars",
        "可视化·条形图",
        "非负从左填充；含负时按绝对长度从左；仅透传数据",
    ),
    (
        "viz_bars_diverging",
        "可视化·双向条形图",
        "零轴居中条形；仅透传数据",
    ),
    (
        "viz_table",
        "可视化·表格",
        "表格展示序列；仅透传数据",
    ),
    (
        "viz_json",
        "可视化·JSON",
        "JSON 原文；仅透传数据",
    ),
    (
        "viz_scalar",
        "可视化·单值",
        "大号单值（多项时仍按自动规则）；仅透传数据",
    ),
)


def _viz_socket_io() -> tuple[tuple[SocketSpec, ...], tuple[SocketSpec, ...]]:
    return (
        (SocketSpec("in", True, "scalar_json"),),
        (SocketSpec("out", False, "scalar_json"),),
    )


def _viz_builtin_entries() -> dict[str, BuiltinNodeSpec]:
    ins, outs = _viz_socket_io()
    return {
        type_id: BuiltinNodeSpec(
            type=type_id,
            label=label,
            description=desc,
            inputs=ins,
            outputs=outs,
        )
        for type_id, label, desc in _VIZ_NODE_META
    }


BUILTIN_NODE_SPECS: dict[str, BuiltinNodeSpec] = {
    "prepare_alphalens": BuiltinNodeSpec(
        type="prepare_alphalens",
        label="计算因子",
        description="根据因子与数据源计算并生成 factor_data_clean",
        inputs=(),
        outputs=(SocketSpec("clean_factor", False, "factor_data_clean"),),
    ),
    **_viz_builtin_entries(),
}


def is_prepare_node_type(node_type: str) -> bool:
    return node_type == "prepare_alphalens"


def is_viz_node_type(node_type: str) -> bool:
    t = (node_type or "").strip()
    return t.startswith(VIZ_NODE_TYPE_PREFIX) or t == "result_visualization"


def sorted_viz_node_type_ids() -> list[str]:
    return sorted(_viz_builtin_entries().keys())


def builtin_node_definition(node_type: str) -> BuiltinNodeSpec:
    return BUILTIN_NODE_SPECS[node_type]


def list_prepare_node_types() -> list[str]:
    return list(BUILTIN_NODE_SPECS.keys())
