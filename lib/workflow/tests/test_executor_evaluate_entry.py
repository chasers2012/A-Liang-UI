"""handler_from_node_class with entry=evaluate."""

from __future__ import annotations

from typing import Any

from workflow import WorkflowNode, handler_from_node_class, workflow_node, workflow_socket


@workflow_node(
    label="t",
    description="",
    entry="evaluate",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
        workflow_socket("q", required=True, value_type="scalar_json"),
    ],
    output_sockets=[
        workflow_socket("out", value_type="scalar_json"),
        workflow_socket("hit", value_type="scalar_json"),
    ],
)
class TestEvalMetricNode:
    @classmethod
    def workflow_metric_kwargs(cls, node: WorkflowNode, inputs: dict[str, Any]) -> dict[str, Any]:
        return {"quantiles": int(inputs["q"]), **dict(node.params or {})}

    @classmethod
    def workflow_publish_evaluate_result(
        cls,
        node: WorkflowNode,
        inputs: dict[str, Any],
        raw: Any,
        primary_socket: str,
    ) -> dict[str, Any]:
        _ = (inputs, raw)
        return {"hit": f"published:{node.id}:{primary_socket}"}

    def evaluate(self, clean_factor: object, **kwargs: Any) -> str:
        _ = clean_factor
        return f"done:{kwargs.get('quantiles')}"


def test_handler_evaluate_entry_calls_evaluate_and_publish():
    from workflow import workflow_node_type_key

    tid = workflow_node_type_key(TestEvalMetricNode)
    node = WorkflowNode(
        id="n1",
        type=tid,
        params={"x": 1},
    )
    handler = handler_from_node_class(TestEvalMetricNode)
    out = handler(
        node,
        {"clean_factor": [1, 2], "q": 5},
    )
    assert out == {"out": "done:5", "hit": "published:n1:out"}
