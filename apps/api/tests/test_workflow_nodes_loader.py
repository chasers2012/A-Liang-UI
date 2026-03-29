"""Tests for :mod:`app.workflow_nodes.loader`."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from app.workflow_nodes.loader import load_domain_node_catalog, load_workspace_extension_catalogs
from workspace import set_workspace_root


@pytest.fixture(autouse=True)
def _reset_workspace_root() -> None:
    yield
    set_workspace_root(None)


def test_load_evaluation_domain_includes_prepare(tmp_path: Path) -> None:
    set_workspace_root(tmp_path)
    cat = load_domain_node_catalog("evaluation")
    assert "prepare_alphalens" in cat.specs
    assert "viz_auto" in cat.handlers
    assert "builtin_mean_ic" in cat.specs
    assert "builtin_mean_return_spread" in cat.handlers


def test_load_agent_domain_ordered_types(tmp_path: Path) -> None:
    set_workspace_root(tmp_path)
    cat = load_domain_node_catalog("agent")
    assert set(cat.specs.keys()) >= {
        "init_context",
        "validate",
        "finalize",
    }


def test_workspace_extension_merges(tmp_path: Path) -> None:
    set_workspace_root(tmp_path)
    domain_root = tmp_path / "workflow_nodes" / "evaluation"
    ext = domain_root / "ext_ws_nodes_pkg"
    ext.mkdir(parents=True)
    (ext / "__init__.py").write_text("", encoding="utf-8")
    (ext / "extra.py").write_text(
        "\n".join(
            [
                "from __future__ import annotations",
                "from collections.abc import Mapping",
                "from typing import Any",
                "",
                "from workflow import WorkflowNode, workflow_node, workflow_socket",
                "",
                "@workflow_node(",
                '    type_id="ext_only_node",',
                '    label="ext",',
                '    description="",',
                "    input_sockets=[],",
                "    output_sockets=[workflow_socket('out', value_type='scalar_json')],",
                '    entry="execute",',
                ")",
                "class ExtNode:",
                "    def execute(self, node: WorkflowNode, inputs: Mapping[str, Any], ctx: Any) -> dict[str, Any]:",
                "        del inputs",
                "        return {'out': 1}",
                "",
            ]
        ),
        encoding="utf-8",
    )
    parent = str(domain_root.resolve())
    try:
        cats = load_workspace_extension_catalogs("evaluation")
        assert len(cats) == 1
        assert "ext_only_node" in cats[0].specs

        merged = load_domain_node_catalog("evaluation")
        assert "ext_only_node" in merged.specs
        assert "prepare_alphalens" in merged.specs
    finally:
        while parent in sys.path:
            sys.path.remove(parent)
