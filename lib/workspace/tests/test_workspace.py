from __future__ import annotations

import pytest

from workspace import (
    Workspace,
    default_workspace_root,
    ensure_dir,
    get_workspace_root,
    set_workspace_root,
    workspace_path,
)


@pytest.fixture(autouse=True)
def _reset_workspace_root():
    yield
    set_workspace_root(None)


def test_default_workspace_root_uses_home_dot_quant_agent(monkeypatch, tmp_path):
    monkeypatch.delenv("QUANT_AGENT_WORKSPACE", raising=False)
    monkeypatch.setattr("pathlib.Path.home", classmethod(lambda cls: tmp_path))
    assert default_workspace_root() == (tmp_path / ".quant-agent").resolve()


def test_default_workspace_root_respects_env(monkeypatch, tmp_path):
    custom = tmp_path / "custom_ws"
    monkeypatch.setenv("QUANT_AGENT_WORKSPACE", str(custom))
    assert default_workspace_root() == custom.resolve()


def test_set_workspace_root_overrides(monkeypatch, tmp_path):
    monkeypatch.delenv("QUANT_AGENT_WORKSPACE", raising=False)
    override = tmp_path / "override"
    set_workspace_root(override)
    assert get_workspace_root() == override.resolve()
    set_workspace_root(None)
    assert get_workspace_root() == default_workspace_root()


def test_ensure_dir_creates_nested(tmp_path):
    set_workspace_root(tmp_path)
    d = ensure_dir("a", "b")
    assert d == tmp_path / "a" / "b"
    assert d.is_dir()


def test_workspace_instance_fixed_root(tmp_path):
    ws = Workspace(tmp_path)
    assert ws.root == tmp_path.resolve()
    sub = ws.ensure_dir("cache")
    assert sub == tmp_path / "cache"
    assert sub.is_dir()


def test_workspace_path_without_parts_uses_root(tmp_path):
    set_workspace_root(tmp_path)
    assert workspace_path() == tmp_path.resolve()
