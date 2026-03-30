"""init_context – initialise shared agent context."""

from __future__ import annotations

from typing import Any

from workflow import workflow_node, workflow_socket


@workflow_node(
    label="初始化上下文",
    description="",
    input_sockets=[workflow_socket("prev", value_type="flow")],
    output_sockets=[workflow_socket("next", value_type="flow")],
    entry="execute",
)
class InitContextNode:
    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        raise NotImplementedError
