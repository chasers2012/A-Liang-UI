from __future__ import annotations

from typing import Any

from app.plugin.schema import PluginConfigSchema
from app.security.fernet import decrypt_str, encrypt_str
from cryptography.fernet import InvalidToken


def _try_decrypt_token(v: str) -> str | None:
    try:
        return decrypt_str(v)
    except InvalidToken:
        return None


def encrypt_secret_fields(
    config: dict[str, Any], schema: PluginConfigSchema | None
) -> dict[str, Any]:
    secret_keys = frozenset(schema.resolved_secret_keys() if schema else [])
    if not secret_keys:
        return dict(config)
    out: dict[str, Any] = dict(config)
    for k in secret_keys:
        if k not in out:
            continue
        v = out.get(k)
        if v is None:
            continue
        if isinstance(v, str):
            if not v.strip():
                continue
            # Keep already-encrypted token stable (idempotent).
            if _try_decrypt_token(v) is not None:
                continue
            out[k] = encrypt_str(v)
    return out


def decrypt_secret_fields(
    config: dict[str, Any], schema: PluginConfigSchema | None
) -> dict[str, Any]:
    secret_keys = frozenset(schema.resolved_secret_keys() if schema else [])
    if not secret_keys:
        return dict(config)
    out: dict[str, Any] = dict(config)
    for k in secret_keys:
        if k not in out:
            continue
        v = out.get(k)
        if isinstance(v, str) and v.strip():
            plain = _try_decrypt_token(v)
            if plain is not None:
                out[k] = plain
    return out
