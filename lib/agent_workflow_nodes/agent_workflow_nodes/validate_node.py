"""validate – dry-run validation with branching outputs."""

from __future__ import annotations

from typing import Any

from workflow import workflow_node, workflow_socket


@workflow_node(
    label="校验 (dry-run)",
    description="",
    input_sockets=[workflow_socket("prev", value_type="flow")],
    output_sockets=[
        workflow_socket("next", value_type="flow"),
        workflow_socket("evaluate", value_type="flow"),
        workflow_socket("regenerate", value_type="flow"),
        workflow_socket("finalize", value_type="flow"),
    ],
    entry="execute",
)
class ValidateNode:
    def execute(self, **kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError
