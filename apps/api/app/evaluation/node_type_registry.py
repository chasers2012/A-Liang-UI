"""Static prepare node spec; metric nodes use metric:<id> (see workflow_graph_types)."""

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
}


def is_prepare_node_type(node_type: str) -> bool:
    return node_type == "prepare_alphalens"


def builtin_node_definition(node_type: str) -> BuiltinNodeSpec:
    return BUILTIN_NODE_SPECS[node_type]


def list_prepare_node_types() -> list[str]:
    return list(BUILTIN_NODE_SPECS.keys())
