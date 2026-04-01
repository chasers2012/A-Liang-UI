from __future__ import annotations

import pytest
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client(workspace_tmp):
    return TestClient(app)
