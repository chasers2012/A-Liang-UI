from __future__ import annotations

from custom_code import SourceFiles
from workspace import set_workspace_root


def test_source_files_round_trip(tmp_path) -> None:
    set_workspace_root(tmp_path)
    try:
        rel = "test_dir/sample.py"
        SourceFiles.write_source_text(rel, "x = 1\n")
        assert SourceFiles.read_source_text(rel) == "x = 1\n"
        assert SourceFiles.resolve_source_path(rel).is_file()

        SourceFiles.delete_source_text_file(rel)
        assert SourceFiles.read_source_text(rel) == ""
    finally:
        set_workspace_root(None)


def test_read_missing_returns_empty(tmp_path) -> None:
    set_workspace_root(tmp_path)
    try:
        assert SourceFiles.read_source_text("nonexistent.py") == ""
    finally:
        set_workspace_root(None)
