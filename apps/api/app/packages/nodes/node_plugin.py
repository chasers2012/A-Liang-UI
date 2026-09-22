from __future__ import annotations

from workflow import Node

from app.packages.plugin import Plugin
from app.packages.visibility.controller import list_domain_node_visibility_configs, toggle_node_visibility

from .registry import WorkflowNodesRegistry


class NodePlugin(Plugin):
    category: str = "nodes"
    nodes: list[type[Node]]
    #: 节点默认在哪些 domain 可见；为空表示不限制。
    visible_domains: tuple[str, ...] = ()

    def register_nodes(self) -> None:
        visible_domains = tuple(
            s.strip() for s in self.visible_domains if isinstance(s, str) and s.strip()
        )
        configured_domains = tuple[str, ...](list_domain_node_visibility_configs().keys())
        for node_cls in self.nodes:
            type_key = getattr(node_cls, "type", "")
            if not isinstance(type_key, str) or not type_key.strip():
                continue
            WorkflowNodesRegistry.register_plugin_node(type_key, node_cls)
            if not visible_domains:
                continue
            for domain in configured_domains:
                if domain not in visible_domains:
                    toggle_node_visibility(domain, type_key, visible=False)

    def on_registered(self) -> None:
        self.register_nodes()
