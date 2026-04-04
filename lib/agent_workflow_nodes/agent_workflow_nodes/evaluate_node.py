"""evaluate – run Alphalens evaluation on generated factor."""

from __future__ import annotations

from typing import Any

from workflow import Socket, workflow_node


@workflow_node(
    label="Alphalens 评价",
    description="",
    input_sockets=[Socket("prev", value_type="flow")],
    output_sockets=[Socket("next", value_type="flow")],
    entry="execute",
)
class EvaluateNode:
    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        raise NotImplementedError
