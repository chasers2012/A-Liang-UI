from __future__ import annotations

import json

import pytest
from app.chat.schemas import LlmSettings
from pydantic import ValidationError


def test_get_llm_settings_returns_defaults(client):
    r = client.get("/chat/llm-settings")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "ollama"
    assert data["model"] == "qwen3.5:9b"
    assert data["ollama_base_url"] == "http://127.0.0.1:11434"
    assert data["openai_base_url"] is None
    assert data["api_key"] is None
    assert data["temperature"] == 1.0
    assert data["ollama_timeout"] == 600.0
    assert data["ollama_num_predict"] == -1
    assert data["ollama_reasoning"] is None


def test_put_llm_settings_round_trip(client, workspace_tmp):
    body = {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "ollama_base_url": "http://127.0.0.1:11434",
        "openai_base_url": "https://example.invalid/v1",
        "api_key": "sk-test",
        "temperature": 0.7,
        "ollama_timeout": 120.0,
        "ollama_num_predict": 512,
        "ollama_reasoning": None,
    }
    r = client.put("/chat/llm-settings", json=body)
    assert r.status_code == 200
    assert r.json() == body

    path = workspace_tmp / "agent" / "llm.json"
    assert path.is_file()
    disk = json.loads(path.read_text(encoding="utf-8"))
    assert disk["provider"] == "openai"
    assert disk["api_key"] == "sk-test"

    r2 = client.get("/chat/llm-settings")
    assert r2.status_code == 200
    assert r2.json() == body


def test_put_strips_empty_api_key(client):
    body = {
        "provider": "ollama",
        "model": "qwen3.5:9b",
        "ollama_base_url": "http://127.0.0.1:11434",
        "openai_base_url": "",
        "api_key": "   ",
        "temperature": 1.0,
        "ollama_timeout": 600.0,
        "ollama_num_predict": -1,
        "ollama_reasoning": None,
    }
    r = client.put("/chat/llm-settings", json=body)
    assert r.status_code == 200
    out = r.json()
    assert out["api_key"] is None
    assert out["openai_base_url"] is None


def test_schema_rejects_empty_model():
    with pytest.raises(ValidationError):
        LlmSettings(model="")
