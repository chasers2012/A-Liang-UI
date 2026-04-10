from __future__ import annotations

from dataclasses import dataclass, field
from typing import ClassVar


@dataclass(frozen=True, slots=True)
class PluginFieldOption:
    value: str
    label: str


@dataclass(frozen=True, slots=True)
class PluginConfigField:
    key: str
    label: str
    required: bool = False
    secret: bool = False
    placeholder: str | None = None
    help_text: str | None = None

    kind: ClassVar[str] = "string"


@dataclass(frozen=True, slots=True)
class StringConfigField(PluginConfigField):
    kind: ClassVar[str] = "string"


@dataclass(frozen=True, slots=True)
class NumberConfigField(PluginConfigField):
    kind: ClassVar[str] = "number"


@dataclass(frozen=True, slots=True)
class BooleanConfigField(PluginConfigField):
    kind: ClassVar[str] = "boolean"


@dataclass(frozen=True, slots=True)
class PasswordConfigField(PluginConfigField):
    kind: ClassVar[str] = "password"


@dataclass(frozen=True, slots=True)
class JsonConfigField(PluginConfigField):
    kind: ClassVar[str] = "json"


@dataclass(frozen=True, slots=True)
class SelectConfigField(PluginConfigField):
    options: list[PluginFieldOption] = field(default_factory=list)
    kind: ClassVar[str] = "select"


@dataclass(frozen=True, slots=True)
class FileConfigField(PluginConfigField):
    file_types: list[str] = field(default_factory=list)
    kind: ClassVar[str] = "file"


@dataclass(frozen=True, slots=True)
class PluginConfigSchema:
    title: str
    description: str | None = None
    fields: list[PluginConfigField] | None = None
