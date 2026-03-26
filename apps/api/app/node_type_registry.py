"""Builtin workflow node types (inputs/outputs for validation and UI)."""

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


BUILTIN_NODE_SPECS: dict[str, BuiltinNodeSpec] = {
    "prepare_alphalens": BuiltinNodeSpec(
        type="prepare_alphalens",
        label="准备 Alphalens",
        description="根据因子与数据源生成 factor_data_clean",
        inputs=(),
        outputs=(SocketSpec("clean_factor", False, "factor_data_clean"),),
    ),
    "mean_information_coefficient": BuiltinNodeSpec(
        type="mean_information_coefficient",
        label="平均 IC",
        description="各持有期平均信息系数（Alphalens）",
        inputs=(SocketSpec("clean_factor", True, "factor_data_clean"),),
        outputs=(SocketSpec("mean_ic", False, "scalar_json"),),
    ),
    "mean_return_spread": BuiltinNodeSpec(
        type="mean_return_spread",
        label="多空收益差",
        description="分位多空平均收益差（按持有期）",
        inputs=(SocketSpec("clean_factor", True, "factor_data_clean"),),
        outputs=(SocketSpec("mean_return_spread", False, "scalar_json"),),
    ),
    "user_metric": BuiltinNodeSpec(
        type="user_metric",
        label="自定义指标",
        description="引用指标库中的 EvaluationMetric 实现",
        inputs=(SocketSpec("clean_factor", True, "factor_data_clean"),),
        outputs=(SocketSpec("out", False, "scalar_json"),),
    ),
}


def is_builtin_type(node_type: str) -> bool:
    return node_type in BUILTIN_NODE_SPECS


def builtin_node_definition(node_type: str) -> BuiltinNodeSpec:
    return BUILTIN_NODE_SPECS[node_type]


def list_builtin_types() -> list[str]:
    return list(BUILTIN_NODE_SPECS.keys())
