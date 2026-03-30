"""Reusable workflow graph primitives, algorithms, and socket decorators.

Public API is grouped roughly as: graph models, execution, node type metadata
(:mod:`workflow.node_types`), discovery (:mod:`workflow.node_registry`), validation.
"""

from .executor import (
    NodeHandler,
    WorkflowExecutor,
    WorkflowUnknownNodeTypeError,
    gather_node_inputs,
    handler_from_node_class,
)
from .graph import WorkflowGraph, WorkflowLink, WorkflowViewport
from .graph_algo import assert_acyclic, topological_order
from .node_decorator import (
    collect_node_classes,
    workflow_node,
    workflow_node_type_key,
    workflow_socket,
)
from .node_registry import (
    NodeRegistry,
    RegisteredNode,
    build_node_registry_from_classes,
    build_node_registry_from_modules,
    merge_node_registries,
    ordered_definitions,
    workflow_node_definition_from_class,
)
from .node_types import (
    BooleanNodeParam,
    EnumNodeParam,
    Node,
    NodeParam,
    NodeParamModel,
    NumberNodeParam,
    Socket,
    StringNodeParam,
    validate_node_param_list,
)
from .validate import validate_workflow_graph, validate_workflow_graph_against_registry

__all__ = [
    "BooleanNodeParam",
    "EnumNodeParam",
    "Node",
    "NodeHandler",
    "NodeParam",
    "NodeParamModel",
    "NodeRegistry",
    "NumberNodeParam",
    "RegisteredNode",
    "Socket",
    "StringNodeParam",
    "WorkflowExecutor",
    "WorkflowGraph",
    "WorkflowLink",
    "WorkflowUnknownNodeTypeError",
    "WorkflowViewport",
    "assert_acyclic",
    "build_node_registry_from_classes",
    "build_node_registry_from_modules",
    "collect_node_classes",
    "gather_node_inputs",
    "handler_from_node_class",
    "merge_node_registries",
    "ordered_definitions",
    "topological_order",
    "validate_node_param_list",
    "validate_workflow_graph",
    "validate_workflow_graph_against_registry",
    "workflow_node",
    "workflow_node_definition_from_class",
    "workflow_node_type_key",
    "workflow_socket",
]
