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
    keys = set(cat.specs.keys())
    assert any(k.endswith(".PrepareAlphalensNode") for k in keys)
    assert any("echarts_line" in k for k in keys)
    assert any(k.endswith(".BuiltinMeanIcNode") for k in keys)
    assert any(k.endswith(".BuiltinMeanReturnSpreadNode") for k in cat.handlers)


def test_load_agent_domain_ordered_types(tmp_path: Path) -> None:
    set_workspace_root(tmp_path)
    cat = load_domain_node_catalog("agent")
    keys = set(cat.specs.keys())
    assert any(k.endswith(".InitContextNode") for k in keys)
    assert any(k.endswith(".ValidateNode") for k in keys)
    assert any(k.endswith(".FinalizeNode") for k in keys)


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
                "from typing import Any",
                "",
                "from workflow import workflow_node, workflow_socket",
                "",
                "@workflow_node(",
                '    label="ext",',
                '    description="",',
                "    input_sockets=[],",
                "    output_sockets=[workflow_socket('out', value_type='scalar_json')],",
                '    entry="execute",',
                ")",
                "class ExtNode:",
                "    def execute(self, **kwargs: Any) -> dict[str, Any]:",
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
        ext_keys = set(cats[0].specs.keys())
        assert any(k.endswith(".ExtNode") for k in ext_keys)

        merged = load_domain_node_catalog("evaluation")
        mk = set(merged.specs.keys())
        assert any(k.endswith(".ExtNode") for k in mk)
        assert any(k.endswith(".PrepareAlphalensNode") for k in mk)
    finally:
        while parent in sys.path:
            sys.path.remove(parent)
