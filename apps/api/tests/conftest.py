from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from workspace import set_workspace_root


@pytest.fixture
def workspace_tmp(tmp_path):
    set_workspace_root(tmp_path)
    yield tmp_path
    set_workspace_root(None)


@pytest.fixture
def client(workspace_tmp):
    return TestClient(app)
