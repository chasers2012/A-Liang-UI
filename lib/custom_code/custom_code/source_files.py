"""Read/write/delete UTF-8 text files under the workspace root (e.g. factor/metric sources)."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from workspace import get_workspace_root


class SourceFiles:
    """Resolve paths relative to workspace root and read/write/delete UTF-8 text."""

    @staticmethod
    def resolve_source_path(source_path: str) -> Path:
        p = Path(source_path)
        if p.is_absolute():
            return p.resolve()
        return (get_workspace_root() / p).resolve()

    @staticmethod
    def read_source_text(source_path: str) -> str:
        path = SourceFiles.resolve_source_path(source_path)
        if not path.is_file():
            return ""
        return path.read_text(encoding="utf-8")

    @staticmethod
    def write_source_text(
        source_path: str,
        text: str,
        validators: list[Callable[[str], None]] | None = None,
    ) -> None:
        if validators:
            SourceFiles.validate_source(text, validators)
        path = SourceFiles.resolve_source_path(source_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")

    @staticmethod
    def delete_source_text_file(source_path: str) -> None:
        path = SourceFiles.resolve_source_path(source_path)
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass

    @staticmethod
    def validate_source(
        source: str,
        validators: list[Callable[[str], None]],
    ) -> None:
        for validator in validators:
            validator(source)
