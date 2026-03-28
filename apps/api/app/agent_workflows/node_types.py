"""Catalog of available agent node types for the workflow editor."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AgentNodeSocket(BaseModel):
    name: str
    required: bool = True
    value_type: str = "flow"


class AgentNodeTypeDefinition(BaseModel):
    type: str
    label: str
    inputs: list[AgentNodeSocket] = Field(default_factory=list)
    outputs: list[AgentNodeSocket] = Field(default_factory=list)


def _node(
    type_key: str,
    label: str,
    *,
    extra_outputs: list[tuple[str, str]] | None = None,
) -> AgentNodeTypeDefinition:
    inputs = [AgentNodeSocket(name="prev", required=False, value_type="flow")]
    outputs = [AgentNodeSocket(name="next", required=False, value_type="flow")]
    if extra_outputs:
        for name, vtype in extra_outputs:
            outputs.append(AgentNodeSocket(name=name, required=False, value_type=vtype))
    return AgentNodeTypeDefinition(
        type=type_key,
        label=label,
        inputs=inputs,
        outputs=outputs,
    )


AGENT_NODE_TYPES: list[AgentNodeTypeDefinition] = [
    _node("init_context", "初始化上下文"),
    _node("ideate", "立意"),
    _node("generate_pseudocode", "生成伪代码"),
    _node("generate_code", "生成代码"),
    _node(
        "validate",
        "校验 (dry-run)",
        extra_outputs=[
            ("evaluate", "flow"),
            ("regenerate", "flow"),
            ("finalize", "flow"),
        ],
    ),
    _node("evaluate", "Alphalens 评价"),
    _node("finalize", "生成报告"),
]
