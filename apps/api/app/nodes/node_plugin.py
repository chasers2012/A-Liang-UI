from __future__ import annotations

from workflow import Node, workflow_node_type_key

from app.nodes.registry import WorkflowNodesRegistry
from app.plugin import Plugin


class NodePlugin(Plugin):
    category: str = "nodes"
    nodes: list[type[Node]]

    def register_nodes(self) -> None:
        for node_cls in self.nodes:
            type_key = getattr(node_cls, "type", "") or workflow_node_type_key(node_cls)
            if isinstance(type_key, str) and type_key.strip():
                WorkflowNodesRegistry.register_plugin_node(type_key, node_cls)

    def on_registered(self) -> None:
        self.register_nodes()
