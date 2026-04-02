"""Tests for :mod:`workflow.node_registry`."""

from __future__ import annotations

import types

import pytest
from workflow import (
    Node,
    NumberNodeParam,
    RegisteredNode,
    Socket,
    StringNodeParam,
    build_node_registry_from_modules,
    handler_from_node_class,
    merge_node_registries,
    ordered_definitions,
    workflow_node,
    workflow_node_definition_from_class,
    workflow_node_type_key,
)


def test_ordered_definitions_order_and_keyerror() -> None:
    a = Node(type="a", label="", description="", inputs=(), outputs=())
    b = Node(type="b", label="", description="", inputs=(), outputs=())

    def _stub(_n, _i):
        return {}

    m = {
        "a": RegisteredNode(definition=a, handler=_stub),
        "b": RegisteredNode(definition=b, handler=_stub),
    }
    assert ordered_definitions(m, ["b", "a"]) == [b, a]
    with pytest.raises(KeyError):
        ordered_definitions(m, ["c"])


def test_merge_node_registries_later_overrides() -> None:

    @workflow_node(
        label="1",
        description="",
        input_sockets=[],
        output_sockets=[Socket("o")],
        entry="execute",
    )
    class First:
        def execute(self, **kwargs):
            return (None,)

    @workflow_node(
        label="2",
        description="",
        input_sockets=[],
        output_sockets=[Socket("o")],
        entry="execute",
    )
    class Second:
        def execute(self, **kwargs):
            return (None,)

    m1 = types.ModuleType("m1")
    m1.First = First
    r1 = build_node_registry_from_modules(m1)
    k = workflow_node_type_key(First)
    defn2 = workflow_node_definition_from_class(Second)
    merged = merge_node_registries(
        r1,
        {
            k: RegisteredNode(
                definition=defn2,
                handler=handler_from_node_class(Second, defn2),
            ),
        },
    )
    assert merged[k].definition.label == "2"


def test_build_merges_types_from_two_modules() -> None:

    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[Socket("o")],
        entry="execute",
    )
    class X:
        def execute(self, **kwargs):
            return (None,)

    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[Socket("o")],
        entry="execute",
    )
    class Y:
        def execute(self, **kwargs):
            return (None,)

    m1 = types.ModuleType("m1")
    m1.X = X
    m2 = types.ModuleType("m2")
    m2.Y = Y
    reg = build_node_registry_from_modules(m1, m2)
    assert set(reg.keys()) == {workflow_node_type_key(X), workflow_node_type_key(Y)}


def test_build_node_registry_includes_workflow_parameters() -> None:

    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[Socket("o")],
        workflow_parameters=[
            StringNodeParam("k1", label="L1", default="x"),
            NumberNodeParam("k2", default=3, minimum=0, maximum=9),
        ],
        entry="execute",
    )
    class WithParamsNode:
        def execute(self, **kwargs):
            return (None,)

    m = types.ModuleType("mwp")
    m.WithParamsNode = WithParamsNode
    reg = build_node_registry_from_modules(m)
    spec = reg[workflow_node_type_key(WithParamsNode)].definition
    assert len(spec.inputs) == 2
    assert spec.inputs[0].name == "k1"
    assert spec.inputs[0].label == "L1"
    assert spec.inputs[0].value_type == "string"
    assert spec.inputs[0].default == "x"
    assert spec.inputs[1].name == "k2"
    assert spec.inputs[1].minimum == 0
    assert spec.inputs[1].maximum == 9


def test_workflow_parameters_two_strings() -> None:

    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[Socket("o")],
        workflow_parameters=[
            StringNodeParam("legacy", default="x"),
            StringNodeParam("mode", label="M", default="a"),
        ],
        entry="execute",
    )
    class MixedNode:
        def execute(self, **kwargs):
            return (None,)

    m = types.ModuleType("mmixed")
    m.MixedNode = MixedNode
    reg = build_node_registry_from_modules(m)
    spec = reg[workflow_node_type_key(MixedNode)].definition
    assert len(spec.inputs) == 2
    assert spec.inputs[0].name == "legacy"
    assert spec.inputs[1].value_type == "string"
    assert spec.inputs[1].default == "a"


def test_handler_execute_wraps_non_mapping_as_primary_socket() -> None:

    @workflow_node(
        label="",
        description="",
        input_sockets=[],
        output_sockets=[Socket("primary_out")],
        entry="execute",
    )
    class BareReturnNode:
        def execute(self, **kwargs):
            return 42

    defn = workflow_node_definition_from_class(BareReturnNode)
    h = handler_from_node_class(BareReturnNode, defn)
    node = Node(id="n1", type="t", pos=[0.0, 0.0], params={})
    assert dict(h(node, {})) == {"primary_out": 42}
