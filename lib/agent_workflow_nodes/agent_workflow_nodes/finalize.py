"""finalize – produce the final report."""

from __future__ import annotations

from typing import Any

from workflow import Socket, workflow_node


@workflow_node(
    label="生成报告",
    description="",
    input_sockets=[Socket(name="prev", value_type="flow")],
    output_sockets=[Socket(name="next", value_type="flow")],
    entry="execute",
)
class FinalizeNode:
    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        raise NotImplementedError
