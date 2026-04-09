"""Centralized parsing helpers for workflow JSON payloads and node Python source."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .node_types import (
        Node,
        NodeParam,
        Socket,
        WorkflowGraph,
        WorkflowLink,
    )


class Parser:
    """Parse workflow payload dictionaries into runtime workflow objects."""

    @staticmethod
    def serialize_socket(socket: Socket) -> dict[str, Any]:
        """JSON-friendly socket / param specification used by API responses."""
        from .node_types import NodeParam, NumberNodeParam, OptionsNodeParam

        if isinstance(socket, NumberNodeParam):
            return {
                **Parser._serialize_node_param(socket),
                "minimum": socket.minimum,
                "maximum": socket.maximum,
            }
        if isinstance(socket, OptionsNodeParam):
            opts = socket.options
            options = list(opts()) if callable(opts) else list(opts or [])
            return {**Parser._serialize_node_param(socket), "options": options}
        if isinstance(socket, NodeParam):
            return Parser._serialize_node_param(socket)
        return {
            "name": socket.name,
            "required": socket.required,
            "label": socket.label,
            "description": socket.description,
            "value_type": socket.value_type,
            "render_type": socket.render_type,
        }

    @staticmethod
    def _serialize_node_param(param: NodeParam) -> dict[str, Any]:
        return {
            "name": param.name,
            "required": param.required,
            "label": param.label,
            "description": param.description,
            "value_type": param.value_type,
            "render_type": param.render_type,
            "default": param.default,
        }

    @staticmethod
    def serialize_node(node: Node) -> dict[str, Any]:
        """JSON-friendly node definition payload."""
        return {
            "type": node.type,
            "label": node.label,
            "description": node.description,
            "category": node.category,
            "inputs": [Parser.serialize_socket(s) for s in node.inputs],
            "outputs": [Parser.serialize_socket(s) for s in node.outputs],
            "params": node.params,
        }

    @staticmethod
    def parse_workflow_link(config_dict: dict[str, Any]) -> WorkflowLink:
        from .node_types import WorkflowLink

        return WorkflowLink(
            id=config_dict.get("id"),
            from_node=config_dict.get("from_node", ""),
            from_socket=config_dict.get("from_socket", ""),
            to_node=config_dict.get("to_node", ""),
            to_socket=config_dict.get("to_socket", ""),
        )

    @staticmethod
    def parse_socket(config_dict: dict[str, Any]) -> Socket:
        from .node_types import Socket

        return Socket(
            name=config_dict.get("name", ""),
            required=config_dict.get("required", False),
            label=config_dict.get("label", ""),
            description=config_dict.get("description", ""),
            value_type=config_dict.get("value_type", ""),
            render_type=config_dict.get("render_type", ""),
        )

    @staticmethod
    def parse_node(json_dict: dict[str, Any]) -> Node:
        from .node_loader import WorkflowNodeLoader

        type_key = json_dict.get("type", "")
        if not isinstance(type_key, str) or not type_key.strip():
            raise ValueError("node payload missing string field 'type'")

        node_cls = WorkflowNodeLoader.instance().resolve(type_key)

        try:
            node_obj = node_cls()  # type: ignore[call-arg]
        except Exception:
            node_obj = node_cls.__new__(node_cls)  # type: ignore[misc]

        node_obj.id = json_dict.get("id", "") if isinstance(json_dict.get("id"), str) else ""

        pos_raw = json_dict.get("pos")
        if isinstance(pos_raw, list) and len(pos_raw) >= 2:
            try:
                node_obj.pos = [float(pos_raw[0]), float(pos_raw[1])]
            except (TypeError, ValueError):
                node_obj.pos = [0.0, 0.0]
        else:
            node_obj.pos = [0.0, 0.0]

        params_raw = json_dict.get("params", {})
        node_obj.params = params_raw if isinstance(params_raw, dict) else {}

        for k in ("label", "description", "category", "entry", "type"):
            v = json_dict.get(k)
            if isinstance(v, str) and v.strip():
                setattr(node_obj, k, v)

        if isinstance(json_dict.get("outputs"), list):
            node_obj.outputs = tuple(
                Parser.parse_socket(s)
                for s in json_dict.get("outputs", [])
                if isinstance(s, dict) and s.get("name")
            )
        if isinstance(json_dict.get("inputs"), list):
            node_obj.inputs = tuple(
                Parser.parse_socket(s)
                for s in json_dict.get("inputs", [])
                if isinstance(s, dict) and s.get("name")
            )

        return node_obj

    @staticmethod
    def parse_workflow_graph(config_dict: dict[str, Any]) -> WorkflowGraph:
        from .node_types import WorkflowGraph

        nodes = [
            Parser.parse_node(node_conf)
            for node_conf in config_dict.get("nodes", [])
            if isinstance(node_conf, dict)
        ]
        links = [
            Parser.parse_workflow_link(link_conf)
            for link_conf in config_dict.get("links", [])
            if isinstance(link_conf, dict)
        ]
        # viewport 不再参与执行与持久化；旧 JSON 中的字段忽略。
        return WorkflowGraph(
            nodes=nodes,
            links=links,
            viewport=None,
        )
