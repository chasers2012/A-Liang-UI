"""init_context – initialise shared agent context."""

from __future__ import annotations

from typing import Any

from workflow import Socket, workflow_node


@workflow_node(
    label="初始化上下文",
    description="",
    input_sockets=[Socket("prev", value_type="flow")],
    output_sockets=[Socket("next", value_type="flow")],
    entry="execute",
)
class InitContextNode:
    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        raise NotImplementedError
