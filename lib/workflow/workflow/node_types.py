"""Workflow node type metadata (sockets, params, nodes) and graph container models.

Socket / :class:`Node` definitions are used by ``@workflow_node`` and
:meth:`collect_node_classes` / catalogs. :class:`WorkflowGraph` holds serialized
graph instances (nodes + links; viewport is not persisted).
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, Literal

# --- Dataclasses (compile-time node metadata) ---------------------------------


class Socket:
    name: str
    required: bool = False
    label: str = ""
    description: str = ""
    value_type: str = ""
    render_type: str = "socket"

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        render_type: str = "socket",
        **_ignored: Any,
    ):
        self.name = name
        self.required = required
        self.label = label if label else name
        self.description = description
        self.value_type = value_type
        self.render_type = render_type


class AppendableSocket(Socket):
    """Wire socket that supports adding more sibling sockets in editor UI."""

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type,
            **_ignored,
            render_type="appendable",
        )


class NodeParam(Socket):
    default = None
    render_type: str = None
    #: ``None``：序列化时使用插件级默认；``()``：任意领域可见；非空元组：仅列出的领域。
    visible_domains: tuple[str, ...] | None = None

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        default: Any | None = None,
        visible_domains: Sequence[str] | tuple[str, ...] | None = None,
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type,
            **_ignored,
            render_type="input",
        )
        self.default = default
        self.render_type = getattr(type(self), "render_type", None)
        if visible_domains is None:
            self.visible_domains = None
        else:
            self.visible_domains = tuple(
                s.strip() for s in visible_domains if isinstance(s, str) and s.strip()
            )


class OptionsNodeParam(NodeParam):
    options: list[str | float | int] | Callable | None = None
    render_type: str = "select"

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        options: list[str | float | int] | Callable | None = None,
        default: Any | None = None,
        visible_domains: Sequence[str] | tuple[str, ...] | None = None,
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type,
            default=default,
            visible_domains=visible_domains,
            **_ignored,
        )
        self.options = options


class NumberNodeParam(NodeParam):
    default: float | int | None = None
    minimum: float | int | None = None
    maximum: float | int | None = None
    value_type: str = "number"
    render_type: str = "number"

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        default: float | int | None = None,
        minimum: float | int | None = None,
        maximum: float | int | None = None,
        visible_domains: Sequence[str] | tuple[str, ...] | None = None,
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type,
            default=default,
            visible_domains=visible_domains,
            **_ignored,
        )
        self.minimum = minimum
        self.maximum = maximum


class StringNodeParam(NodeParam):
    default: str = ""
    value_type: str = "string"
    render_type: str = "input"

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        default: str = "",
        visible_domains: Sequence[str] | tuple[str, ...] | None = None,
        **_ignored: Any,
    ) -> None:
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type or self.value_type,
            default=default,
            visible_domains=visible_domains,
            **_ignored,
        )


class TextareaNodeParam(StringNodeParam):
    """多行字符串参数（前端用 textarea 渲染，适合 JSON、长文本）。"""

    render_type: str = "textarea"

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        default: str = "",
        rows: int = 6,
        visible_domains: Sequence[str] | tuple[str, ...] | None = None,
        **_ignored: Any,
    ) -> None:
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type,
            default=default,
            visible_domains=visible_domains,
            **_ignored,
        )
        self.rows = max(2, min(int(rows), 40))


class BooleanNodeParam(NodeParam):
    default: bool = False
    value_type: str = "boolean"
    render_type: str = "toggle"


class DateTimeNodeParam(NodeParam):
    default: str = ""
    value_type: str = "datetime"
    render_type: str = "datetime"

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        default: str = "",
        visible_domains: Sequence[str] | tuple[str, ...] | None = None,
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type or self.value_type,
            default=default or self.default,
            visible_domains=visible_domains,
            **_ignored,
        )


class DateNodeParam(NodeParam):
    default: str = ""
    value_type: str = "date"
    render_type: str = "date"

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        default: str = "",
        visible_domains: Sequence[str] | tuple[str, ...] | None = None,
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type or self.value_type,
            default=default or self.default,
            visible_domains=visible_domains,
            **_ignored,
        )


class Node:
    """Unified workflow node model for both type-definition and graph-instance data.

    Graph instances carry ``id``, ``pos``, and ``type`` only.
    """

    # Graph-instance fields
    id: str = ""
    pos: list[float]
    params: dict[str, Any]

    # Type-definition fields
    type: str = ""
    label: str = ""
    description: str = ""
    category: str = ""
    entry: str = "execute"
    inputs: tuple[Socket, ...] = ()
    outputs: tuple[Socket, ...] = ()

    def __init__(
        self,
        *,
        id: str = "",
        pos: list[float] | None = None,
        type: str = "",
        label: str = "",
        description: str = "",
        category: str = "",
        entry: str = "execute",
        inputs: tuple[Socket, ...] | None = None,
        outputs: tuple[Socket, ...] | None = None,
        params: dict[str, Any] | None = None,
    ) -> None:
        self.id = id
        self.pos = list(pos or [0.0, 0.0])
        self.type = type
        self.label = label
        self.description = description
        self.category = category
        self.entry = entry
        self.inputs = inputs or ()
        self.outputs = outputs or ()
        self.params = params or {}

    def execute(self, **_kwargs: Any) -> tuple[Any, ...]:
        pass


# --- Graph instance models (nodes + links) ------------------------------------

WorkflowEndpointKind = Literal["node", "workflow_input", "workflow_output"]


class WorkflowEndpoint:
    kind: WorkflowEndpointKind
    node_id: str | None
    socket: str

    def __init__(
        self,
        *,
        kind: WorkflowEndpointKind,
        socket: str,
        node_id: str | None = None,
    ) -> None:
        self.kind = kind
        self.socket = socket
        self.node_id = node_id

    def serialize(self) -> dict[str, Any]:
        if self.kind == "node":
            return {"kind": "node", "node_id": self.node_id or "", "socket": self.socket}
        if self.kind == "workflow_input":
            return {"kind": "workflow_input", "socket": self.socket}
        return {"kind": "workflow_output", "socket": self.socket}


class WorkflowLink:
    id: str | None = None
    from_: WorkflowEndpoint
    to: WorkflowEndpoint

    def __init__(
        self,
        *,
        id: str | None = None,
        from_: WorkflowEndpoint | None = None,
        to: WorkflowEndpoint | None = None,
    ) -> None:
        self.id = id
        self.from_ = from_ or WorkflowEndpoint(kind="node", node_id="", socket="")
        self.to = to or WorkflowEndpoint(kind="node", node_id="", socket="")

    def serialize(self) -> dict[str, Any]:
        return {"id": self.id, "from": self.from_.serialize(), "to": self.to.serialize()}


class WorkflowViewport:
    x: float = 0.0
    y: float = 0.0
    zoom: float = 1.0

    def __init__(self, x: float = 0.0, y: float = 0.0, zoom: float = 1.0) -> None:
        self.x = x
        self.y = y
        self.zoom = zoom

    def serialize(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "zoom": self.zoom,
        }


class WorkflowGraph:
    nodes: list[Node]
    links: list[WorkflowLink]
    workflow_inputs: list[Socket]
    workflow_outputs: list[Socket]
    viewport: WorkflowViewport | None

    def __init__(
        self,
        *,
        nodes: list[Node] | None = None,
        links: list[WorkflowLink] | None = None,
        workflow_inputs: list[Socket] | None = None,
        workflow_outputs: list[Socket] | None = None,
        viewport: WorkflowViewport | None = None,
    ) -> None:
        self.nodes = list(nodes or [])
        self.links = list(links or [])
        self.workflow_inputs = list(workflow_inputs or [])
        self.workflow_outputs = list(workflow_outputs or [])
        self.viewport = viewport

    def serialize(self) -> dict:
        from .parser import Parser

        nodes_payload: list[dict[str, Any]] = []
        for node in self.nodes:
            nodes_payload.append(Parser.serialize_node(node))
        return {
            "nodes": nodes_payload,
            "links": [link.serialize() for link in self.links],
            "workflow_inputs": [Parser.serialize_socket(s) for s in self.workflow_inputs],
            "workflow_outputs": [Parser.serialize_socket(s) for s in self.workflow_outputs],
        }
