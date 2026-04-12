from app.plugin import Plugin
from workflow import Node, WorkflowNodeLoader, workflow_node_type_key


class NodePlugin(Plugin):
    category: str = "nodes"
    nodes: list[type[Node]]

    def register_nodes(self):
        loader = WorkflowNodeLoader.instance()
        for node_cls in self.nodes:
            type_key = getattr(node_cls, "type", "") or workflow_node_type_key(node_cls)
            if isinstance(type_key, str) and type_key.strip():
                loader.register_node(type_key, node_cls)

    def on_registered(self) -> None:
        self.register_nodes()
