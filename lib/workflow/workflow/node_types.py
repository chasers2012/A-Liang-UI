"""Workflow node type metadata: dataclass definitions and JSON :class:`NodeParamModel`.

- **Dataclasses** ``Socket``, ``NodeParam`` subclasses, ``Node``: used by ``@workflow_node`` and
  :meth:`collect_node_classes` / catalogs.
- **Pydantic** ``NodeParamModel`` / :func:`validate_node_param_list`: same public JSON shape as
  ``NodeParam.serialize()``; used by API layers that need validation without Python node classes.
"""

from __future__ import annotations

import importlib
import re
from collections.abc import Callable
from functools import lru_cache
from typing import Any, Literal

# --- Dataclasses (compile-time node metadata) ---------------------------------


class Socket:
    name: str
    required: bool = False
    label: str = ""
    value_type: str = ""

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        value_type: str = "",
        **_ignored: Any,
    ):
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
    render_type: str = None

    def __init__(
        self,
        name: str,
        required: bool = False,
        label: str = "",
        value_type: str = "",
        default: Any | None = None,
        **_ignored: Any,
    ):
        super().__init__(name, required, label, value_type)
        self.default = default

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
        value_type: str = "",
        options: list[str | float | int] | Callable | None = None,
        default: Any | None = None,
        **_ignored: Any,
    ):
        super().__init__(name, required, label, value_type, default)
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
        value_type: str = "",
        default: float | int | None = None,
        minimum: float | int | None = None,
        maximum: float | int | None = None,
        **_ignored: Any,
    ):
        super().__init__(name, required, label, value_type, default)
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
        value_type: str = "",
        default: str = "",
        **_ignored: Any,
    ) -> None:
        super().__init__(
            name,
            required,
            label,
            value_type or self.value_type,
            default,
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
        value_type: str = "",
        default: str = "",
        **_ignored: Any,
    ):
        super().__init__(
            name, required, label, value_type or self.value_type, default or self.default
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
        value_type: str = "",
        default: str = "",
        **_ignored: Any,
    ):
        super().__init__(
            name, required, label, value_type or self.value_type, default or self.default
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
            "params": self.params,
        }

    @staticmethod
    def parse(json_dict: dict[str, Any]) -> Node:
        """Parse a workflow graph node config.

        Expected JSON shape is consistent with :meth:`serialize` (plus a few
        optional UI fields like ``description`` that may be omitted).
        """

        if not isinstance(json_dict, dict):
            raise TypeError("node payload must be an object")

        type_key = json_dict.get("type", "")
        if not isinstance(type_key, str) or not type_key.strip():
            raise ValueError("node payload missing string field 'type'")

        node_cls = _resolve_workflow_node_class(type_key)

        # Try to build the node instance. Many built-in nodes have no required
        # __init__ args; still, we mirror parse_workflow_node_source's behavior
        # (fall back to __new__ if no-arg init fails).
        try:
            node_obj: Node = node_cls()  # type: ignore[call-arg]
        except Exception:
            node_obj = node_cls.__new__(node_cls)  # type: ignore[misc]

        # Graph-instance fields.
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

        # Optional UI/persisted overrides (do not affect execution semantics).
        for k in ("label", "description", "category", "entry", "type"):
            v = json_dict.get(k)
            if isinstance(v, str) and v.strip():
                setattr(node_obj, k, v)

        # If the resolved class doesn't carry socket metadata (or it was lost),
        # we can reconstruct socket order from JSON payload.
        if not getattr(node_obj, "outputs", None) and isinstance(json_dict.get("outputs"), list):
            node_obj.outputs = tuple(
                Socket.parse(s)
                for s in json_dict.get("outputs", [])
                if isinstance(s, dict) and s.get("name")
            )
        if not getattr(node_obj, "inputs", None) and isinstance(json_dict.get("inputs"), list):
            node_obj.inputs = tuple(
                Socket.parse(s)
                for s in json_dict.get("inputs", [])
                if isinstance(s, dict) and s.get("name")
            )

        return node_obj


_NODE_TYPE_RESOLVERS: list[Callable[[str], type[Node] | None]] = []


def register_workflow_node_type_resolver(
    resolver: Callable[[str], type[Node] | None],
    *,
    prepend: bool = False,
) -> None:
    """Register a callback that resolves workflow-node classes from ``type``.

    This makes ``Node.parse()`` extensible: applications can map domain-specific
    identifiers (e.g. metric ids stored in workflow JSON) to concrete
    ``Node`` subclasses without workflow lib hardcoding storage paths.
    """
    if prepend:
        _NODE_TYPE_RESOLVERS.insert(0, resolver)
    else:
        _NODE_TYPE_RESOLVERS.append(resolver)
    _resolve_workflow_node_class.cache_clear()


@lru_cache(maxsize=1024)
def _resolve_workflow_node_class(type_key: str) -> type[Node]:
    """Resolve a workflow node ``type`` into a Node subclass."""

    # 1) Domain resolvers registered by the application.
    for resolver in _NODE_TYPE_RESOLVERS:
        cls = resolver(type_key)
        if cls is not None:
            return cls

    # 2) Default: importable ``module.qualname.Class`` string.
    if "." not in type_key:
        raise ValueError(f"unknown workflow node type {type_key!r}")

    parts = [p for p in type_key.split(".") if p]
    if len(parts) < 2:
        raise ValueError(f"invalid workflow node type: {type_key!r}")

    last_err: Exception | None = None
    # Split from the right: module candidates first, then qualname attributes.
    for i in range(len(parts) - 1, 0, -1):
        module_name = ".".join(parts[:i])
        qual_parts = parts[i:]
        try:
            module = importlib.import_module(module_name)
        except Exception as e:
            last_err = e
            continue

        obj = _walk_qual_parts(module, qual_parts)
        if obj is None:
            continue
        if isinstance(obj, type) and issubclass(obj, Node):
            return obj

    raise ValueError(
        f"unknown workflow node type {type_key!r}"
        + (f" (last error: {last_err!r})" if last_err else "")
    )


def _walk_qual_parts(obj: object, qual_parts: list[str]) -> object | None:
    """Walk a dotted attribute chain, returning ``None`` if any part is missing."""
    for qp in qual_parts:
        if not hasattr(obj, qp):
            return None
        obj = getattr(obj, qp)
    return obj


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
