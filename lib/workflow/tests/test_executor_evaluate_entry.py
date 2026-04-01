"""handler_from_node_class with entry=evaluate."""

from __future__ import annotations

from typing import Any

from workflow import (
    Node,
    Socket,
    handler_from_node_class,
    workflow_node,
    workflow_node_definition_from_class,
)


@workflow_node(
    label="t",
    description="",
    entry="evaluate",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
        Socket("q", required=True, value_type="scalar_json"),
    ],
    output_sockets=[
        Socket("out", value_type="scalar_json"),
        Socket("hit", value_type="scalar_json"),
    ],
)
class TestEvalMetricNode:
    @classmethod
    def workflow_metric_kwargs(cls, node: Node, inputs: dict[str, Any]) -> dict[str, Any]:
        return {"quantiles": int(inputs["q"]), **dict(node.params or {})}

    @classmethod
    def workflow_publish_evaluate_result(
        cls,
        node: Node,
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
    node = Node(
        id="n1",
        type=tid,
        params={"x": 1},
    )
    handler = handler_from_node_class(
        TestEvalMetricNode,
        workflow_node_definition_from_class(TestEvalMetricNode),
    )
    out = handler(
        node,
        {"clean_factor": [1, 2], "q": 5},
    )
    assert out == {"out": "done:5", "hit": "published:n1:out"}


@workflow_node(
    label="t2",
    description="",
    entry="evaluate",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[
        Socket("first", value_type="scalar_json"),
        Socket("second", value_type="scalar_json"),
    ],
)
class TestEvalTupleNode:
    def evaluate(self, clean_factor: object, **kwargs: object) -> tuple[str, str]:
        _ = (clean_factor, kwargs)
        return "a", "b"


def test_handler_evaluate_tuple_without_publisher() -> None:
    from workflow import workflow_node_type_key

    tid = workflow_node_type_key(TestEvalTupleNode)
    node = Node(id="n2", type=tid, params={})
    handler = handler_from_node_class(
        TestEvalTupleNode,
        workflow_node_definition_from_class(TestEvalTupleNode),
    )
    out = handler(node, {"clean_factor": [1]})
    assert dict(out) == {"first": "a", "second": "b"}


@workflow_node(
    label="t3",
    description="",
    entry="evaluate",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[
        Socket("first", value_type="scalar_json"),
        Socket("second", value_type="scalar_json"),
    ],
)
class TestEvalTupleWithPublishNode:
    @classmethod
    def workflow_publish_evaluate_result(
        cls,
        node: Node,
        inputs: dict[str, Any],
        raw: Any,
        primary_socket: str,
    ) -> dict[str, Any]:
        _ = inputs
        return {"second": f"pub:{primary_socket}:{raw[1]}"}

    def evaluate(self, clean_factor: object, **kwargs: object) -> tuple[str, str]:
        _ = (clean_factor, kwargs)
        return "x", "y"


def test_handler_evaluate_tuple_with_publisher_prefers_publisher_for_second() -> None:
    from workflow import workflow_node_type_key

    tid = workflow_node_type_key(TestEvalTupleWithPublishNode)
    node = Node(id="n3", type=tid, params={})
    handler = handler_from_node_class(
        TestEvalTupleWithPublishNode,
        workflow_node_definition_from_class(TestEvalTupleWithPublishNode),
    )
    out = handler(node, {"clean_factor": [1]})
    assert out["first"] == "x"
    assert out["second"] == "pub:first:y"


@workflow_node(
    label="t0",
    description="",
    entry="evaluate",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[],
)
class TestEvalZeroOutWithPublishNode:
    @classmethod
    def workflow_publish_evaluate_result(
        cls,
        node: Node,
        inputs: dict[str, Any],
        raw: Any,
        primary_socket: str,
    ) -> dict[str, Any]:
        _ = (inputs, raw, primary_socket)
        return {"published_only": f"node:{node.id}"}

    def evaluate(self, clean_factor: object, **kwargs: object) -> str:
        _ = (clean_factor, kwargs)
        return "raw-ignored"


def test_handler_evaluate_zero_outputs_publisher_no_primary_injection() -> None:
    from workflow import workflow_node_type_key

    tid = workflow_node_type_key(TestEvalZeroOutWithPublishNode)
    node = Node(id="n0", type=tid, params={})
    handler = handler_from_node_class(
        TestEvalZeroOutWithPublishNode,
        workflow_node_definition_from_class(TestEvalZeroOutWithPublishNode),
    )
    out = dict(handler(node, {"clean_factor": [1]}))
    assert out == {"published_only": "node:n0"}
    assert "out" not in out
