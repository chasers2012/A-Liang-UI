from __future__ import annotations


def parse_csv_query(value: str | None) -> list[str] | None:
    if value is None:
        return None
    items = [part.strip() for part in value.split(",") if part.strip()]
    return items or None
