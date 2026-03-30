"""Tests for :mod:`app.workflow_nodes.loader`."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from app.workflow_nodes import WorkflowNodeLoader
from workspace import set_workspace_root


@pytest.fixture(autouse=True)
def _reset_workspace_root() -> None:
    yield
    set_workspace_root(None)


def test_evaluation_catalog_excludes_agent_nodes(tmp_path: Path) -> None:
    from app.evaluation.scheme.workflow_graph_types import (
        all_workflow_node_type_ids,
        get_evaluation_node_registry,
    )

    get_evaluation_node_registry.cache_clear()
    set_workspace_root(tmp_path)
    try:
        ids = all_workflow_node_type_ids()
        assert all(not t.startswith("agent_workflow_nodes.") for t in ids)
        assert any(t.startswith("evaluation_workflow_nodes.") for t in ids)
        full = get_evaluation_node_registry()
        assert any(k.startswith("agent_workflow_nodes.") for k in full)
    finally:
        get_evaluation_node_registry.cache_clear()
        set_workspace_root(None)


def test_load_workspace_registry_includes_evaluation_and_agent_nodes(tmp_path: Path) -> None:
    set_workspace_root(tmp_path)
    reg = WorkflowNodeLoader.load_workspace_node_registry()
    keys = set(reg.keys())
    assert any(k.endswith(".CalculateFactorValueNode") for k in keys)
    assert any("echarts_line" in k for k in keys)
    assert any(k.endswith(".BuiltinMeanIcNode") for k in keys)
    assert any(k.endswith(".BuiltinMeanReturnSpreadNode") for k in keys)
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
                "    def execute(self, **kwargs: Any) -> tuple[int, ...]:",
                "        return 1,",
                "",
            ]
        ),
        encoding="utf-8",
    )
    parent_eval = str(domain_root.resolve())
    parent_agent = str((tmp_path / "workflow_nodes" / "agent").resolve())
    try:
        regs = WorkflowNodeLoader.load_workspace_extension_registries()
        assert len(regs) >= 1
        ext_regs = [r for r in regs if any(k.endswith(".ExtNode") for k in r)]
        assert len(ext_regs) == 1
        ext_keys = set(ext_regs[0].keys())
        assert any(k.endswith(".ExtNode") for k in ext_keys)

        merged = WorkflowNodeLoader.load_workspace_node_registry()
        mk = set(merged.keys())
        assert any(k.endswith(".ExtNode") for k in mk)
        assert any(k.endswith(".CalculateFactorValueNode") for k in mk)
    finally:
        for parent in (parent_eval, parent_agent):
            while parent in sys.path:
                sys.path.remove(parent)
