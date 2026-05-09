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

    def resolved_secret_keys(self) -> list[str]:
        """
        Secret keys used for config redaction / encryption.

        If `secret_keys` is explicitly provided, it wins.
        Otherwise infer top-level secret keys from RJSF ui_schema entries whose
        `ui:widget` is set to "password".
        """

        if self.secret_keys:
            return list(self.secret_keys)
        ui = self.ui_schema if isinstance(self.ui_schema, dict) else {}
        out: list[str] = []
        for k, vv in ui.items():
            if not isinstance(k, str) or not k:
                continue
            if not isinstance(vv, dict):
                continue
            if vv.get("ui:widget") == "password":
                out.append(k)
        # preserve insertion order, unique
        return list(dict.fromkeys(out))
