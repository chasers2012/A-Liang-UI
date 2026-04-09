from __future__ import annotations

import pytest
from app.main import app
from app.persistence import sqlite_db
from fastapi.testclient import TestClient
from workspace import set_workspace_root


@pytest.fixture
def workspace_tmp(tmp_path):
    sqlite_db.get_engine.cache_clear()
    set_workspace_root(tmp_path)
    yield tmp_path
    set_workspace_root(None)


@pytest.fixture
def client(workspace_tmp):
    with TestClient(app) as c:
        yield c
