"""ideate – brainstorm factor ideas."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from workflow import WorkflowNode, workflow_node, workflow_socket


@workflow_node(
    label="立意",
    description="",
    input_sockets=[workflow_socket("prev", value_type="flow")],
    output_sockets=[workflow_socket("next", value_type="flow")],
    entry="execute",
)
class IdeateNode:
    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
    ) -> dict[str, Any]:
        raise NotImplementedError
