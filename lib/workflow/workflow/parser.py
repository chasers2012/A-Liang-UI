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
        from .node_types import (
            NodeParam,
            NumberNodeParam,
            OptionsNodeParam,
            RJSFNodeParam,
            TextareaNodeParam,
        )

        if isinstance(socket, NumberNodeParam):
            return {
                **Parser._serialize_node_param(socket),
                "minimum": socket.minimum,
                "maximum": socket.maximum,
            }
        if isinstance(socket, TextareaNodeParam):
            return {**Parser._serialize_node_param(socket), "rows": socket.rows}
        if isinstance(socket, OptionsNodeParam):
            opts = socket.options
            options = list(opts()) if callable(opts) else list(opts or [])
            return {**Parser._serialize_node_param(socket), "options": options}
        if isinstance(socket, RJSFNodeParam):
            schema = socket.resolve_json_schema()
            ui = socket.resolve_ui_schema()
            default = socket.default if socket.default is not None else schema.get("default")
            return {
                **Parser._serialize_node_param(socket),
                "default": default,
                "json_schema": schema,
                "ui_schema": ui,
            }
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
            "visible_domains": list(getattr(param, "visible_domains", None) or ()),
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
        from .node_types import WorkflowEndpoint, WorkflowLink

        raw_from = config_dict.get("from")
        raw_to = config_dict.get("to")
        if not isinstance(raw_from, dict) or not isinstance(raw_to, dict):
            raise ValueError("link payload missing object fields 'from' and 'to'")

        fk = raw_from.get("kind")
        tk = raw_to.get("kind")
        if fk not in {"node", "workflow_input"}:
            raise ValueError("link.from.kind must be 'node' or 'workflow_input'")
        if tk not in {"node", "workflow_output"}:
            raise ValueError("link.to.kind must be 'node' or 'workflow_output'")

        from_socket = raw_from.get("socket")
        to_socket = raw_to.get("socket")
        if not isinstance(from_socket, str) or not from_socket.strip():
            raise ValueError("link.from.socket must be non-empty string")
        if not isinstance(to_socket, str) or not to_socket.strip():
            raise ValueError("link.to.socket must be non-empty string")

        from_node_id = raw_from.get("node_id")
        to_node_id = raw_to.get("node_id")
        if fk == "node":
            if not isinstance(from_node_id, str) or not from_node_id.strip():
                raise ValueError("link.from.node_id must be non-empty string when kind='node'")
        else:
            from_node_id = None

        if tk == "node":
            if not isinstance(to_node_id, str) or not to_node_id.strip():
                raise ValueError("link.to.node_id must be non-empty string when kind='node'")
        else:
            to_node_id = None

        return WorkflowLink(
            id=config_dict.get("id"),
            from_=WorkflowEndpoint(
                kind="node" if fk == "node" else "workflow_input",
                node_id=from_node_id if fk == "node" else None,
                socket=from_socket,
            ),
            to=WorkflowEndpoint(
                kind="node" if tk == "node" else "workflow_output",
                node_id=to_node_id if tk == "node" else None,
                socket=to_socket,
            ),
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

        node_cls = WorkflowNodeLoader.resolve(type_key)

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
        workflow_inputs = [
            Parser.parse_socket(socket_conf)
            for socket_conf in config_dict.get("workflow_inputs", [])
            if isinstance(socket_conf, dict) and socket_conf.get("name")
        ]
        workflow_outputs = [
            Parser.parse_socket(socket_conf)
            for socket_conf in config_dict.get("workflow_outputs", [])
            if isinstance(socket_conf, dict) and socket_conf.get("name")
        ]
        # viewport 不再参与执行与持久化；旧 JSON 中的字段忽略。
        return WorkflowGraph(
            nodes=nodes,
            links=links,
            workflow_inputs=workflow_inputs,
            workflow_outputs=workflow_outputs,
            viewport=None,
        )
