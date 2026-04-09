from __future__ import annotations

from typing import Any

from sqlmodel import TEXT, TypeDecorator

from app.persistence.json_codec import dumps_json, loads_json


class JsonText(TypeDecorator):  # type: ignore[misc]
    """
    Store arbitrary JSON-serializable Python values in SQLite TEXT.

    Notes:
    - `None` is stored as SQL NULL.
    """

    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value: Any, dialect) -> str | None:  # type: ignore[override]
        if value is None:
            return None
        return dumps_json(value)

    def process_result_value(self, value: str | None, dialect) -> Any:  # type: ignore[override]
        if value is None:
            return None
        return loads_json(value)
