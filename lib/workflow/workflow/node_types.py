"""Workflow node type metadata: dataclass definitions and JSON :class:`NodeParamModel`.

- **Dataclasses** ``Socket``, ``NodeParam`` subclasses, ``Node``: used by ``@workflow_node`` and
  :meth:`collect_node_classes` / catalogs.
- **Pydantic** ``NodeParamModel`` / :func:`validate_node_param_list`: same public JSON shape as
  ``NodeParam.serialize()``; used by API layers that need validation without Python node classes.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any, Literal

# --- Dataclasses (compile-time node metadata) ---------------------------------


class Socket:
    name: str
    required: bool = False
    label: str = ""
    value_type: str = ""

    def __init__(self, name: str, required: bool = False, label: str = "", value_type: str = ""):
        self.name = name
        self.required = required
        self.label = label if label else name
        self.value_type = value_type

    @staticmethod
    def parse(config_dict: dict) -> Socket:
        return Socket(
            name=config_dict.get("name", ""),
            required=config_dict.get("required", False),
            label=config_dict.get("label", ""),
            value_type=config_dict.get("value_type", ""),
        )

    def serialize(self) -> dict[str, Any]:
        """JSON-friendly socket specification used by API responses."""
        return {
            "name": self.name,
            "required": self.required,
            "label": self.label,
            "value_type": self.value_type,
        }


class NodeParam(Socket):
    default = None

    def serialize(self) -> dict[str, Any]:
        """JSON-friendly socket specification used by API responses."""
        return {
            **super().serialize(),
            "default": self.default,
        }


class OptionsNodeParam(NodeParam):
    options: list[str | float | int] | Callable | None = None

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

    def serialize(self) -> dict[str, Any]:
        return {**super().serialize(), "minimum": self.minimum, "maximum": self.maximum}


class StringNodeParam(NodeParam):
    default: str = ""
    value_type: str = "string"


class BooleanNodeParam(NodeParam):
    default: bool = False
    value_type: str = "boolean"


class Node:
    """Unified workflow node model for both type-definition and graph-instance data."""

    # Graph-instance fields
    id: str = ""
    pos: list[float]

    # Type-definition fields
    type: str = ""
    label: str = ""
    description: str = ""
    category: str = ""
    entry: str = "execute"
    inputs: tuple[Socket, ...] = ()
    outputs: tuple[Socket, ...] = ()
    parameters: tuple[NodeParam, ...] = ()

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
        inputs: tuple[Socket, ...] = (),
        outputs: tuple[Socket, ...] = (),
        parameters: tuple[NodeParam, ...] = (),
        params: dict[str, Any] | None = None,
    ) -> None:
        # Note: `params` is accepted for graph-instance payloads (stored on the instance)
        # while `parameters` is node type-definition metadata.
        self.id = id
        self.pos = list(pos or [0.0, 0.0])
        self.type = type
        self.label = label
        self.description = description
        self.category = category
        self.entry = entry
        self.inputs = inputs
        self.outputs = outputs
        self.parameters = parameters
        if params is not None:
            self.params = params

    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
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
            "parameters": [p.serialize() for p in self.parameters],
        }

    @staticmethod
    def parse(json_dict: dict[str, Any]) -> Node:
        return Node(
            id=json_dict.get("id", ""),
            pos=json_dict.get("pos", [0.0, 0.0]),
            type=json_dict.get("type", ""),
            label=json_dict.get("label", ""),
            description=json_dict.get("description", ""),
        )


# --- Pydantic (JSON interchange) ------------------------------------------------

_PARAM_KEY_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class NodeParamModel:
    """Declarative schema for workflow node parameters (besides graph inputs).

    For ``entry="execute"``, parameter keys are merged into the keyword arguments
    passed to ``execute`` along with linked socket values.
    """

    def __init__(
        self,
        key: str,
        label: str = "",
        type: Literal["number", "boolean", "string"] = "number",
        default: Any | None = None,
        minimum: float | int | None = None,
        maximum: float | int | None = None,
    ) -> None:
        self.key = key
        self.label = label
        self.type = type
        self.default = default
        self.minimum = minimum
        self.maximum = maximum


def validate_node_param_list(items: list[NodeParamModel]) -> None:
    keys = [x.key for x in items]
    if len(keys) != len(set(keys)):
        raise ValueError("workflow_parameters 存在重复的 key")
