"""Tests for node return value coercion (aligned with OUTPUT_SOCKETS order)."""

from __future__ import annotations

import pytest
from workflow import (
    Node,
    handler_from_node_class,
    workflow_node,
    workflow_node_definition_from_class,
    workflow_socket,
)


def test_handler_execute_zero_outputs_returns_empty() -> None:
    @workflow_node(
        label="",
        description="",
        input_sockets=[workflow_socket("x")],
        output_sockets=[],
        entry="execute",
    )
    class NoOutNode:
        def execute(self, **kwargs):
            return "ignored"

    h = handler_from_node_class(NoOutNode, workflow_node_definition_from_class(NoOutNode))
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
    assert dict(h(node, {"x": 1})) == {}


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

    h = handler_from_node_class(TupleOutNode, workflow_node_definition_from_class(TupleOutNode))
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
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

    h = handler_from_node_class(UnitTupleNode, workflow_node_definition_from_class(UnitTupleNode))
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
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

    h = handler_from_node_class(BadNode, workflow_node_definition_from_class(BadNode))
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
    with pytest.raises(ValueError, match="tuple or list"):
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

    h = handler_from_node_class(BadTupleNode, workflow_node_definition_from_class(BadTupleNode))
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
    with pytest.raises(ValueError, match="return has 3 value"):
        h(node, {})


def test_handler_execute_list_matches_output_sockets() -> None:
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
    class ListOutNode:
        def execute(self, **kwargs):
            return [1, 2]

    h = handler_from_node_class(ListOutNode, workflow_node_definition_from_class(ListOutNode))
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
    assert dict(h(node, {})) == {"a": 1, "b": 2}


def test_handler_execute_single_socket_wraps_arbitrary_value() -> None:
    """Single output socket wraps any return value (including ``dict``)."""

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

    h = handler_from_node_class(
        ReturnsObjectNode, workflow_node_definition_from_class(ReturnsObjectNode)
    )
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
    out = dict(h(node, {}))
    assert out["only"] is sentinel
