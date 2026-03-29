"""validate – dry-run validation with branching outputs."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from workflow import WorkflowNode, workflow_node, workflow_socket


@workflow_node(
    type_id="validate",
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
    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
        ctx: Any,
    ) -> dict[str, Any]:
        raise NotImplementedError
