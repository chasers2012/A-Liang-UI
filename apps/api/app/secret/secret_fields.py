from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from cryptography.fernet import InvalidToken

from app.secret.fernet import decrypt_str, encrypt_str


def _try_decrypt_token(v: str) -> str | None:
    try:
        return decrypt_str(v)
    except InvalidToken:
        return None


def _normalize_secret_keys(secret_keys: Iterable[str] | None) -> frozenset[str]:
    if secret_keys is None:
        return frozenset()
    return frozenset(str(k) for k in secret_keys)


def encrypt_fields(
    config: dict[str, Any],
    secret_keys: Iterable[str] | None = None,
) -> dict[str, Any]:
    keys = _normalize_secret_keys(secret_keys)
    if not keys:
        return dict(config)
    out: dict[str, Any] = dict(config)
    for k in keys:
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


def decrypt_fields(
    config: dict[str, Any],
    secret_keys: Iterable[str] | None = None,
) -> dict[str, Any]:
    keys = _normalize_secret_keys(secret_keys)
    if not keys:
        return dict(config)
    out: dict[str, Any] = dict(config)
    for k in keys:
        if k not in out:
            continue
        v = out.get(k)
        if isinstance(v, str) and v.strip():
            plain = _try_decrypt_token(v)
            if plain is not None:
                out[k] = plain
    return out
