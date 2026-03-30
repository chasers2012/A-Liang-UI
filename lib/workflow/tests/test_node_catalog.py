"""Tests for :mod:`workflow.node_catalog`."""

from __future__ import annotations

import types

import pytest
from workflow import (
    EnumNodeParam,
    Node,
    NodeCatalog,
    NumberNodeParam,
    StringNodeParam,
    build_node_catalog_from_modules,
    handler_from_node_class,
    merge_node_catalogs,
    ordered_specs,
    workflow_node,
    workflow_node_type_key,
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
        label="1",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class First:
        def execute(self, **kwargs):
            return {}

    @workflow_node(
        label="2",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class Second:
        def execute(self, **kwargs):
            return {}

    m1 = types.ModuleType("m1")
    m1.First = First
    c1 = build_node_catalog_from_modules(m1)
    k = workflow_node_type_key(First)
    merged = merge_node_catalogs(
        c1,
        NodeCatalog(
            classes={k: Second},
            specs={k: Second.__node_spec__()},  # type: ignore[attr-defined]
            handlers={k: handler_from_node_class(Second)},
        ),
    )
    assert merged.classes[k] is Second
    assert merged.specs[k].label == "2"


def test_build_merges_types_from_two_modules() -> None:
    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class X:
        def execute(self, **kwargs):
            return {}

    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[workflow_socket("o")],
        entry="execute",
    )
    class Y:
        def execute(self, **kwargs):
            return {}

    m1 = types.ModuleType("m1")
    m1.X = X
    m2 = types.ModuleType("m2")
    m2.Y = Y
    cat = build_node_catalog_from_modules(m1, m2)
    assert set(cat.specs.keys()) == {workflow_node_type_key(X), workflow_node_type_key(Y)}


def test_build_node_catalog_includes_workflow_parameters() -> None:
    @workflow_node(
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
    class WithParamsNode:
        def execute(self, **kwargs):
            return {}

    m = types.ModuleType("mwp")
    m.WithParamsNode = WithParamsNode
    cat = build_node_catalog_from_modules(m)
    spec = cat.specs[workflow_node_type_key(WithParamsNode)]
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
    class MixedNode:
        def execute(self, **kwargs):
            return {}

    m = types.ModuleType("mmixed")
    m.MixedNode = MixedNode
    cat = build_node_catalog_from_modules(m)
    spec = cat.specs[workflow_node_type_key(MixedNode)]
    assert len(spec.parameters) == 2
    assert spec.parameters[0].key == "legacy"
    assert spec.parameters[1].type == "enum"
    assert spec.parameters[1].enum_values == ("a", "b")
    assert spec.parameters[1].default == "a"
