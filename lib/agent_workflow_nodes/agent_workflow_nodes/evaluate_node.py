"""evaluate – run Alphalens evaluation on generated factor."""

from __future__ import annotations

from typing import Any

from workflow import workflow_node, workflow_socket


@workflow_node(
    label="Alphalens 评价",
    description="",
    input_sockets=[workflow_socket("prev", value_type="flow")],
    output_sockets=[workflow_socket("next", value_type="flow")],
    entry="execute",
)
class EvaluateNode:
    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        raise NotImplementedError
