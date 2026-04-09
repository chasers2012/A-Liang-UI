from __future__ import annotations

import shutil
from collections.abc import Callable

from custom_code import SourceFiles
from workspace import workspace_path

from app.preprocessors.constants import USER_PREPROCESSOR_ROOT


class PreprocessorPackageManager:
    @staticmethod
    def get_package_dir(preprocessor_id: str) -> str:
        return f"pp_{preprocessor_id.replace('-', '_')}"

    @staticmethod
    def get_source_path(preprocessor_id: str) -> str:
        return f"{USER_PREPROCESSOR_ROOT}/{PreprocessorPackageManager.get_package_dir(preprocessor_id)}/preprocessor.py"

    @staticmethod
    def write_preprocessor_package(
        preprocessor_id: str,
        source: str,
        *,
        validators: list[Callable[[str], None]] | None = None,
    ) -> None:
        pkg_dir = PreprocessorPackageManager.get_package_dir(preprocessor_id)
        source_path = PreprocessorPackageManager.get_source_path(preprocessor_id)

        pkg_root = workspace_path("workflow_nodes", "preprocessors", pkg_dir)
        pkg_root.mkdir(parents=True, exist_ok=True)
        SourceFiles.write_source_text(source_path, source, validators=validators)

    @staticmethod
    def delete_preprocessor_package(preprocessor_id: str) -> None:
        pkg_dir = PreprocessorPackageManager.get_package_dir(preprocessor_id)
        pkg_root = workspace_path("workflow_nodes", "preprocessors", pkg_dir)
        if pkg_root.is_dir():
            shutil.rmtree(pkg_root, ignore_errors=True)
