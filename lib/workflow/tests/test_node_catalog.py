"""Tests for :mod:`workflow.node_catalog`."""

from __future__ import annotations

import types

import pytest
from workflow import (
    NodeSpec,
    build_node_catalog_from_modules,
    merge_node_catalogs,
    ordered_specs,
    workflow_node,
    workflow_socket,
)


def test_ordered_specs_order_and_keyerror() -> None:
    a = NodeSpec(type="a", label="", description="", inputs=(), outputs=())
    b = NodeSpec(type="b", label="", description="", inputs=(), outputs=())
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
