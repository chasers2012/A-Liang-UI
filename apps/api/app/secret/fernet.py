from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet
from workspace import workspace_path

_ENV_KEY = "A_LIANG_UI_FERNET_KEY"
_KEY_FILE = "data/secrets/fernet.key"


def _read_or_create_key_file(path: Path) -> bytes:
    if path.exists():
        return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    path.write_bytes(key)
    return key


@lru_cache(maxsize=1)
def get_fernet() -> Fernet:
    """
    Encryption for secrets at rest.

    Key priority:
    1) env var A_LIANG_UI_FERNET_KEY
    2) workspace file data/secrets/fernet.key (auto-generated if missing)
    """

    env = os.getenv(_ENV_KEY, "").strip()
    key = env.encode("utf-8") if env else _read_or_create_key_file(workspace_path(_KEY_FILE))
    return Fernet(key)


def encrypt_str(s: str) -> str:
    return get_fernet().encrypt(s.encode("utf-8")).decode("utf-8")


def decrypt_str(token: str) -> str:
    return get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
