from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PluginConfigSchema:
    """
    Schema for rendering plugin config forms in the frontend via react-jsonschema-form (RJSF).

    - `json_schema`: RJSF JSON Schema (draft-07-ish object schema).
    - `ui_schema`: RJSF UI Schema (widgets, placeholders, help text, ordering, etc.).
    - `secret_keys`: top-level config keys that should be redacted when returning config to clients.
    """

    title: str
    description: str | None = None
    json_schema: dict[str, Any] = field(default_factory=dict)
    ui_schema: dict[str, Any] = field(default_factory=dict)
    secret_keys: list[str] = field(default_factory=list)
