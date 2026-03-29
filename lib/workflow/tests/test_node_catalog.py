"""Tests for :mod:`workflow.node_catalog`."""

from __future__ import annotations

import types

import pytest
from workflow import (
    EnumNodeParam,
    Node,
    NumberNodeParam,
    StringNodeParam,
    build_node_catalog_from_modules,
    merge_node_catalogs,
    ordered_specs,
    workflow_node,
    workflow_socket,
)


def test_ordered_specs_order_and_keyerror() -> None:
    a = Node(type="a", label="", description="", inputs=(), outputs=())
    b = Node(type="b", label="", description="", inputs=(), outputs=())
    m = {"a": a, "b": b}
    assert ordered_specs(m, ["b", "a"]) == [b, a]
    with pytest.raises(KeyError):
        ordered_specs(m, ["c"])


def test_merge_node_catalogs_later_overrides() -> None:
    @workflow_node(
        type_id="dup",
        label="1",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class First:
        def execute(self, node, inputs, ctx):
            return {}

    @workflow_node(
        type_id="dup",
        label="2",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class Second:
        def execute(self, node, inputs, ctx):
            return {}

    m1 = types.ModuleType("m1")
    m1.First = First
    m2 = types.ModuleType("m2")
    m2.Second = Second
    c1 = build_node_catalog_from_modules(m1)
    c2 = build_node_catalog_from_modules(m2)
    merged = merge_node_catalogs(c1, c2)
    assert merged.classes["dup"] is Second
    assert merged.specs["dup"].label == "2"


def test_build_merges_types_from_two_modules() -> None:
    @workflow_node(
        type_id="x",
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class X:
        def execute(self, node, inputs, ctx):
            return {}

    @workflow_node(
        type_id="y",
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class Y:
        def execute(self, node, inputs, ctx):
            return {}

    m1 = types.ModuleType("m1")
    m1.X = X
    m2 = types.ModuleType("m2")
    m2.Y = Y
    cat = build_node_catalog_from_modules(m1, m2)
    assert set(cat.specs.keys()) == {"x", "y"}


def test_build_node_catalog_includes_workflow_parameters() -> None:
    @workflow_node(
        type_id="with_params",
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        workflow_parameters=[
            StringNodeParam("k1", label="L1", default="x"),
            NumberNodeParam("k2", default=3, minimum=0, maximum=9),
        ],
        entry="execute",
    )
    class WithParams:
        def execute(self, node, inputs, ctx):
            return {}

    m = types.ModuleType("mwp")
    m.WithParams = WithParams
    cat = build_node_catalog_from_modules(m)
    spec = cat.specs["with_params"]
    assert len(spec.parameters) == 2
    assert spec.parameters[0].key == "k1"
    assert spec.parameters[0].label == "L1"
    assert spec.parameters[0].type == "string"
    assert spec.parameters[0].default == "x"
    assert spec.parameters[1].key == "k2"
    assert spec.parameters[1].minimum == 0
    assert spec.parameters[1].maximum == 9


def test_workflow_parameters_string_and_enum() -> None:
    @workflow_node(
        type_id="mixed_params",
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        workflow_parameters=[
            StringNodeParam("legacy", default="x"),
            EnumNodeParam(
                "mode",
                label="M",
                enum_values=["a", "b"],
                default="a",
            ),
        ],
        entry="execute",
    )
    class Mixed:
        def execute(self, node, inputs, ctx):
            return {}

    m = types.ModuleType("mmixed")
    m.Mixed = Mixed
    cat = build_node_catalog_from_modules(m)
    spec = cat.specs["mixed_params"]
    assert len(spec.parameters) == 2
    assert spec.parameters[0].key == "legacy"
    assert spec.parameters[1].type == "enum"
    assert spec.parameters[1].enum_values == ("a", "b")
    assert spec.parameters[1].default == "a"
