"""finalize – produce the final report."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from workflow import WorkflowNode, workflow_node, workflow_socket


@workflow_node(
    label="生成报告",
    description="",
    input_sockets=[workflow_socket("prev", value_type="flow")],
    output_sockets=[workflow_socket("next", value_type="flow")],
    entry="execute",
)
class FinalizeNode:
    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
    ) -> dict[str, Any]:
        raise NotImplementedError
