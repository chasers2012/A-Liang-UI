"""Workflow node type metadata for workflow sockets, params, and nodes.

Used by ``@workflow_node`` and :meth:`collect_node_classes` / catalogs.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

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

    def serialize(self) -> dict[str, Any]:
        """JSON-friendly socket specification used by API responses."""
        return {
            "name": self.name,
            "required": self.required,
            "label": self.label,
            "description": self.description,
            "value_type": self.value_type,
            "render_type": self.render_type,
        }


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

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        description: str = "",
        value_type: str = "",
        default: Any | None = None,
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

    def serialize(self) -> dict[str, Any]:
        """JSON-friendly socket specification used by API responses."""
        return {
            **super().serialize(),
            "default": self.default,
            "render_type": self.render_type,
        }


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
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type,
            default=default,
            **_ignored,
        )
        self.options = options

    def serialize(self) -> dict[str, Any]:
        opts = self.options
        options = list(opts()) if callable(opts) else list(opts or [])
        return {
            **super().serialize(),
            "options": options,
        }


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
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type,
            default=default,
            **_ignored,
        )
        self.minimum = minimum
        self.maximum = maximum

    def serialize(self) -> dict[str, Any]:
        return {**super().serialize(), "minimum": self.minimum, "maximum": self.maximum}


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
        **_ignored: Any,
    ) -> None:
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type or self.value_type,
            default=default,
            **_ignored,
        )


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
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type or self.value_type,
            default=default or self.default,
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
        **_ignored: Any,
    ):
        super().__init__(
            name=name,
            required=required,
            label=label,
            description=description,
            value_type=value_type or self.value_type,
            default=default or self.default,
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

    def serialize(self) -> dict[str, Any]:
        """JSON-friendly node definition payload."""
        return {
            "type": self.type,
            "label": self.label,
            "description": self.description,
            "category": self.category,
            "inputs": [s.serialize() for s in self.inputs],
            "outputs": [s.serialize() for s in self.outputs],
            "params": self.params,
        }
