"""Read/write/delete UTF-8 text files under the workspace root (e.g. factor/metric sources)."""

from __future__ import annotations

from pathlib import Path

from workspace import get_workspace_root


def resolve_source_path(source_path: str) -> Path:
    p = Path(source_path)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


def read_source_text(source_path: str) -> str:
    path = resolve_source_path(source_path)
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def write_source_text(source_path: str, text: str) -> None:
    path = resolve_source_path(source_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def delete_source_text_file(source_path: str) -> None:
    path = resolve_source_path(source_path)
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass
