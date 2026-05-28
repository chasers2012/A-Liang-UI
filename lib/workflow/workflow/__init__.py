"""Reusable workflow graph primitives, algorithms, and socket decorators.

Public API is grouped roughly as: graph models, execution, node type metadata
(:mod:`workflow.node_types`), discovery (:mod:`workflow.node_registry`), validation.
"""

from .editing import (
    add_node,
    connect_nodes,
    connect_to_workflow_output,
    connect_workflow_input,
    disconnect_link,
    move_node,
    remove_node,
    set_node_param,
    unset_node_param,
    update_node_metadata,
)
from .executor import WorkflowExecutor, WorkflowUnknownNodeTypeError, gather_node_inputs
from .graph_algo import topological_order
from .node_decorator import collect_node_classes, workflow_node, workflow_node_type_key
from .node_loader import WorkflowNodeLoader
from .node_types import (
    AppendableSocket,
    BooleanNodeParam,
    Node,
    NodeParam,
    NumberNodeParam,
    OptionsNodeParam,
    Socket,
    StringNodeParam,
    TextareaNodeParam,
    WorkflowGraph,
    WorkflowLink,
    WorkflowViewport,
)
from .validation import validate_required_workflow_fields

__all__ = [
    "AppendableSocket",
    "BooleanNodeParam",
    "Node",
    "NodeParam",
    "NumberNodeParam",
    "OptionsNodeParam",
    "Socket",
    "StringNodeParam",
    "TextareaNodeParam",
    "WorkflowExecutor",
    "WorkflowGraph",
    "WorkflowLink",
    "WorkflowNodeLoader",
    "WorkflowUnknownNodeTypeError",
    "WorkflowViewport",
    "add_node",
    "collect_node_classes",
    "connect_nodes",
    "connect_to_workflow_output",
    "connect_workflow_input",
    "disconnect_link",
    "gather_node_inputs",
    "move_node",
    "remove_node",
    "set_node_param",
    "topological_order",
    "unset_node_param",
    "update_node_metadata",
    "validate_required_workflow_fields",
    "workflow_node",
    "workflow_node_type_key",
]
