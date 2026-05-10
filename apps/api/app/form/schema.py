from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

from app.secret.secret_fields import decrypt_fields, encrypt_fields


@dataclass(frozen=True)
class FormSchema:
    """
    Describe a react-jsonschema-form (RJSF) form for the frontend.

    - `json_schema`: RJSF JSON Schema (draft-07-ish object schema).
    - `ui_schema`: RJSF UI Schema (widgets, placeholders, help text, ordering, etc.).
    - `secret_keys`: top-level property names whose values should be redacted when returning submitted data to clients.
    """

    title: str
    description: str | None = None
    json_schema: dict[str, Any] = field(default_factory=dict)
    ui_schema: dict[str, Any] = field(default_factory=dict)
    secret_keys: list[str] = field(default_factory=list)

    @staticmethod
    def _password_paths_from_ui(ui: Any, prefix: list[str]) -> list[str]:
        """Collect dotted paths for every nested ``ui:widget: password`` field."""
        if not isinstance(ui, dict):
            return []
        out: list[str] = []
        for k, v in ui.items():
            sk = str(k)
            if sk.startswith("ui:"):
                continue
            if not isinstance(v, dict):
                continue
            if v.get("ui:widget") == "password":
                out.append(".".join([*prefix, sk]))
                continue
            out.extend(FormSchema._password_paths_from_ui(v, [*prefix, sk]))
        return out

    @staticmethod
    def is_unchanged_secret_value(val: Any) -> bool:
        """True when client did not provide a new secret value."""

        return val is None or (isinstance(val, str) and str(val).strip() in ("", "***"))

    def merge_overlay_keep_secrets(
        self,
        saved_plain: dict[str, Any],
        overlay: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Merge ``overlay`` onto plaintext ``saved_plain`` while preserving old
        secret values when client sends placeholders (``None``, empty, ``***``).
        """

        keys = frozenset(str(k) for k in self.resolved_secret_keys())
        merged = dict(saved_plain)
        for key, val in overlay.items():
            sk = str(key)
            if sk in keys and FormSchema.is_unchanged_secret_value(val) and sk in merged:
                continue
            merged[sk] = val
        return merged

    def resolved_secret_keys(self) -> list[str]:
        """
        Field names treated as secret for redaction or encryption.

        If `secret_keys` is explicitly provided, it wins.
        Otherwise infer top-level keys from RJSF ui_schema entries whose
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

    def resolved_secret_key_paths(self) -> list[str]:
        """
        Dotted paths (e.g. ``providers.openai.api_key``) for redacting nested secrets.

        If `secret_keys` is explicitly provided, each entry is a path: a single segment
        denotes a **root** property; segments joined with ``.`` denote nesting.

        Otherwise infer paths by walking `ui_schema` for ``ui:widget: password``
        (including under dynamic object keys such as provider ids).
        """

        if self.secret_keys:
            paths: list[str] = []
            for raw in self.secret_keys:
                p = str(raw or "").strip()
                if p:
                    paths.append(p)
            return list(dict.fromkeys(paths))
        return list(dict.fromkeys(FormSchema._password_paths_from_ui(self.ui_schema, [])))

    @staticmethod
    def _apply_redact_paths(data: dict[str, Any], paths: list[str]) -> None:
        for path in paths:
            parts = [p for p in str(path).split(".") if p]
            if not parts:
                continue
            cur: Any = data
            for seg in parts[:-1]:
                if not isinstance(cur, dict):
                    cur = None
                    break
                cur = cur.get(seg)
            if not isinstance(cur, dict):
                continue
            leaf = parts[-1]
            if leaf in cur:
                cur[leaf] = ""

    def redact(self, data: dict[str, Any]) -> dict[str, Any]:
        """
        Deep-copy ``data`` and clear values at dotted paths from
        :meth:`resolved_secret_key_paths`.

        If no paths resolve, returns a deep copy unchanged.
        """

        out = deepcopy(dict(data))
        paths = self.resolved_secret_key_paths()
        if paths:
            FormSchema._apply_redact_paths(out, paths)
        return out

    def decrypt_form(self, data: dict[str, Any]) -> dict[str, Any]:
        """Decrypt top-level fields resolved as secrets in this form."""

        return decrypt_fields(dict(data or {}), self.resolved_secret_keys())

    def encrypt_form(self, data: dict[str, Any]) -> dict[str, Any]:
        """Encrypt top-level fields resolved as secrets in this form."""

        return encrypt_fields(dict(data or {}), self.resolved_secret_keys())
