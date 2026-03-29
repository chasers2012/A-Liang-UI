"""Scaffold ``workflow_nodes/evaluation/em_<metric_id>/`` for user metrics."""

from __future__ import annotations

import shutil
from collections.abc import Callable

from custom_code import SourceFiles
from workspace import workspace_path

from .metric_schemas import (
    user_metric_init_path,
    user_metric_package_parts,
    user_metric_source_path,
)


def write_user_metric_package(
    metric_id: str,
    source: str,
    *,
    validators: list[Callable[[str], None]] | None = None,
) -> None:
    """Create package dir, ``__init__.py``, and ``metric_node.py``."""
    pkg_dir, _, _ = user_metric_package_parts(metric_id)
    workspace_path("workflow_nodes", "evaluation", pkg_dir).mkdir(parents=True, exist_ok=True)
    SourceFiles.write_source_text(
        user_metric_init_path(metric_id),
        "# User evaluation metric package\nfrom . import metric_node  # noqa: F401\n",
    )
    SourceFiles.write_source_text(
        user_metric_source_path(metric_id),
        source,
        validators=validators,
    )


def delete_user_metric_package(metric_id: str) -> None:
    pkg_dir, _, _ = user_metric_package_parts(metric_id)
    p = workspace_path("workflow_nodes", "evaluation", pkg_dir)
    if p.is_dir():
        shutil.rmtree(p, ignore_errors=True)
