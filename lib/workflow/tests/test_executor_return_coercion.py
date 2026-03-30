"""Tests for node return value coercion (dict / tuple / scalar)."""

from __future__ import annotations

import pytest
from workflow import (
    WorkflowNode,
    handler_from_node_class,
    workflow_node,
    workflow_socket,
)


def test_handler_execute_tuple_matches_output_sockets() -> None:
    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[
            workflow_socket("a"),
            workflow_socket("b"),
        ],
        entry="execute",
    )
    class TupleOutNode:
        def execute(self, **kwargs):
            return 1, 2

    h = handler_from_node_class(TupleOutNode)
    node = WorkflowNode(id="n1", type="t", pos=[0.0, 0.0], params={})
    assert dict(h(node, {})) == {"a": 1, "b": 2}


def test_handler_execute_single_socket_accepts_unit_tuple() -> None:
    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("only")],
        entry="execute",
    )
    class UnitTupleNode:
        def execute(self, **kwargs):
            return ("x",)

    h = handler_from_node_class(UnitTupleNode)
    node = WorkflowNode(id="n1", type="t", pos=[0.0, 0.0], params={})
    assert dict(h(node, {})) == {"only": "x"}


def test_handler_execute_multi_output_scalar_raises() -> None:
    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("x"), workflow_socket("y")],
        entry="execute",
    )
    class BadNode:
        def execute(self, **kwargs):
            return 99

    h = handler_from_node_class(BadNode)
    node = WorkflowNode(id="n1", type="t", pos=[0.0, 0.0], params={})
    with pytest.raises(ValueError, match="neither dict nor tuple"):
        h(node, {})


def test_handler_execute_tuple_length_mismatch_raises() -> None:
    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("a"), workflow_socket("b")],
        entry="execute",
    )
    class BadTupleNode:
        def execute(self, **kwargs):
            return 1, 2, 3

    h = handler_from_node_class(BadTupleNode)
    node = WorkflowNode(id="n1", type="t", pos=[0.0, 0.0], params={})
    with pytest.raises(ValueError, match="tuple return length"):
        h(node, {})


def test_handler_execute_non_dict_not_treated_as_socket_map() -> None:
    """Only ``dict`` is socket-keyed; other objects use single-socket or tuple rules."""

    sentinel = object()

    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("only")],
        entry="execute",
    )
    class ReturnsObjectNode:
        def execute(self, **kwargs):
            return sentinel

    h = handler_from_node_class(ReturnsObjectNode)
    node = WorkflowNode(id="n1", type="t", pos=[0.0, 0.0], params={})
    out = dict(h(node, {}))
    assert out["only"] is sentinel
