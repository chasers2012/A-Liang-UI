"""Reusable workflow graph primitives, algorithms, and socket decorators.

Public API is grouped roughly as: graph models, execution, node type metadata
(:mod:`workflow.node_types`), discovery (:mod:`workflow.node_catalog`), validation.
"""

from .executor import (
    NodeHandler,
    WorkflowExecutor,
    WorkflowUnknownNodeTypeError,
    gather_node_inputs,
    handler_from_node_class,
)
from .graph import WorkflowGraph, WorkflowLink, WorkflowNode, WorkflowViewport
from .graph_algo import assert_acyclic, topological_order
from .node_catalog import (
    NodeCatalog,
    build_node_catalog_from_modules,
    merge_node_catalogs,
    ordered_specs,
)
from .node_decorator import (
    collect_node_classes,
    workflow_node,
    workflow_node_type_key,
    workflow_socket,
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
from .registry import NodeTypeRegistry
from .validate import validate_workflow_graph

__all__ = [
    "BooleanNodeParam",
    "EnumNodeParam",
    "Node",
    "NodeCatalog",
    "NodeHandler",
    "NodeParam",
    "NodeParamModel",
    "NodeTypeRegistry",
    "NumberNodeParam",
    "Socket",
    "StringNodeParam",
    "WorkflowExecutor",
    "WorkflowGraph",
    "WorkflowLink",
    "WorkflowNode",
    "WorkflowUnknownNodeTypeError",
    "WorkflowViewport",
    "assert_acyclic",
    "build_node_catalog_from_modules",
    "collect_node_classes",
    "gather_node_inputs",
    "handler_from_node_class",
    "merge_node_catalogs",
    "ordered_specs",
    "topological_order",
    "validate_node_param_list",
    "validate_workflow_graph",
    "workflow_node",
    "workflow_node_type_key",
    "workflow_socket",
]
