"""Workflow node type metadata: dataclass definitions and JSON :class:`NodeParamModel`.

- **Dataclasses** ``Socket``, ``NodeParam`` subclasses, ``Node``: used by ``@workflow_node`` and
  :meth:`collect_node_classes` / catalogs.
- **Pydantic** ``NodeParamModel`` / :func:`validate_node_param_list`: same public JSON shape as
  ``NodeParam.to_public_dict()``; used by API layers that need validation without Python node classes.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# --- Dataclasses (compile-time node metadata) ---------------------------------


@dataclass(frozen=True)
class Socket:
    name: str
    required: bool = False
    value_type: str = "any"


@dataclass(frozen=True)
class NodeParam(ABC):
    """API-serializable description of one node execution kwarg (besides graph inputs)."""

    key: str
    label: str = ""

    @property
    @abstractmethod
    def type(self) -> str:
        """Discriminator for JSON: ``number`` | ``string`` | ``boolean`` | ``enum``."""

    @abstractmethod
    def to_public_dict(self) -> dict[str, Any]:
        """Shape aligned with :class:`NodeParamModel` JSON."""


@dataclass(frozen=True)
class NumberNodeParam(NodeParam):
    default: Any = None
    minimum: float | int | None = None
    maximum: float | int | None = None

    @property
    def type(self) -> str:
        return "number"

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "type": self.type,
            "default": self.default,
            "minimum": self.minimum,
            "maximum": self.maximum,
            "enum_values": [],
        }


@dataclass(frozen=True)
class StringNodeParam(NodeParam):
    default: str = ""

    @property
    def type(self) -> str:
        return "string"

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "type": self.type,
            "default": self.default,
            "minimum": None,
            "maximum": None,
            "enum_values": [],
        }


@dataclass(frozen=True)
class BooleanNodeParam(NodeParam):
    default: bool = False

    @property
    def type(self) -> str:
        return "boolean"

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "type": self.type,
            "default": self.default,
            "minimum": None,
            "maximum": None,
            "enum_values": [],
        }


@dataclass(frozen=True)
class EnumNodeParam(NodeParam):
    enum_values: tuple[str, ...] = ()
    default: Any = None

    def __post_init__(self) -> None:
        ev = self.enum_values
        if isinstance(ev, list) or not isinstance(ev, tuple):
            object.__setattr__(self, "enum_values", tuple(str(x) for x in ev))

    @property
    def type(self) -> str:
        return "enum"

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "type": self.type,
            "default": self.default,
            "minimum": None,
            "maximum": None,
            "enum_values": list(self.enum_values),
        }


class Node(BaseModel):
    """Unified workflow node model for both type-definition and graph-instance data."""

    model_config = ConfigDict(extra="ignore")

    # Graph-instance fields
    id: str = ""
    pos: list[float] = Field(default_factory=lambda: [0.0, 0.0])
    params: dict[str, Any] = Field(default_factory=dict)

    # Type-definition fields
    type: str
    label: str = ""
    description: str = ""
    entry: str = "execute"
    inputs: tuple[Socket, ...] = ()
    outputs: tuple[Socket, ...] = ()
    parameters: tuple[NodeParam, ...] = ()

    @field_validator("pos")
    @classmethod
    def _two_floats(cls, v: list[float]) -> list[float]:
        if len(v) != 2:
            raise ValueError("pos must be [x, y]")
        return [float(v[0]), float(v[1])]

    def serialize(self) -> dict[str, Any]:
        """JSON-friendly node definition payload."""
        return {
            "type": self.type,
            "label": self.label,
            "description": self.description,
            "inputs": [
                {
                    "name": s.name,
                    "required": s.required,
                    "value_type": s.value_type,
                }
                for s in self.inputs
            ],
            "outputs": [
                {
                    "name": s.name,
                    "required": s.required,
                    "value_type": s.value_type,
                }
                for s in self.outputs
            ],
            "parameters": [p.to_public_dict() for p in self.parameters],
        }


# --- Pydantic (JSON interchange) ------------------------------------------------

_PARAM_KEY_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class NodeParamModel(BaseModel):
    """Declarative schema for workflow node parameters (besides graph inputs).

    For ``entry="execute"``, parameter keys are merged into the keyword arguments
    passed to ``execute`` along with linked socket values.
    """

    model_config = ConfigDict(extra="ignore")

    key: str
    label: str = ""
    type: Literal["number", "boolean", "enum", "string"] = "number"
    default: Any | None = None
    minimum: float | int | None = None
    maximum: float | int | None = None
    enum_values: list[str] = Field(default_factory=list)

    @field_validator("key")
    @classmethod
    def _key_ok(cls, v: str) -> str:
        s = str(v).strip()
        if not s or not _PARAM_KEY_RE.match(s):
            raise ValueError("参数 key 须为合法 Python 标识符")
        return s

    @field_validator("label")
    @classmethod
    def _label_strip(cls, v: str) -> str:
        return str(v).strip()

    @field_validator("enum_values", mode="before")
    @classmethod
    def _enum_strip(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("enum_values 须为字符串数组")
        out: list[str] = []
        for x in v:
            s = str(x).strip()
            if s:
                out.append(s)
        return out

    @model_validator(mode="after")
    def _type_rules(self) -> NodeParamModel:
        if self.type == "enum":
            if not self.enum_values:
                raise ValueError(f"枚举参数 {self.key!r} 须设置非空 enum_values")
            if self.default is not None and str(self.default) not in self.enum_values:
                raise ValueError(
                    f"参数 {self.key!r} 的 default 须在 enum_values 内",
                )
        return self


def validate_node_param_list(items: list[NodeParamModel]) -> None:
    keys = [x.key for x in items]
    if len(keys) != len(set(keys)):
        raise ValueError("workflow_parameters 存在重复的 key")
