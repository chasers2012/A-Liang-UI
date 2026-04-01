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
)
from .node_types import (
    BooleanNodeParam,
    Node,
    NodeParam,
    NodeParamModel,
    NumberNodeParam,
    OptionsNodeParam,
    Socket,
    StringNodeParam,
    validate_node_param_list,
)

__all__ = [
    "BooleanNodeParam",
    "Node",
    "NodeHandler",
    "NodeParam",
    "NodeParamModel",
    "NumberNodeParam",
    "OptionsNodeParam",
    "Socket",
    "StringNodeParam",
    "WorkflowExecutor",
    "WorkflowGraph",
    "WorkflowLink",
    "WorkflowUnknownNodeTypeError",
    "WorkflowViewport",
    "assert_acyclic",
    "collect_node_classes",
    "gather_node_inputs",
    "handler_from_node_class",
    "topological_order",
    "validate_node_param_list",
    "workflow_node",
    "workflow_node_type_key",
]
