"""validate – dry-run validation with branching outputs."""

from __future__ import annotations

from typing import Any

from workflow import Socket, workflow_node


@workflow_node(
    label="校验 (dry-run)",
    description="",
    input_sockets=[Socket("prev", value_type="flow")],
    output_sockets=[
        Socket("next", value_type="flow"),
        Socket("evaluate", value_type="flow"),
        Socket("regenerate", value_type="flow"),
        Socket("finalize", value_type="flow"),
    ],
    entry="execute",
)
class ValidateNode:
    def execute(self, **kwargs: Any) -> tuple[Any, Any, Any, Any]:
        raise NotImplementedError
