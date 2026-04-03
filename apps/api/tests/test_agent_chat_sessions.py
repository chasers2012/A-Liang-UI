from __future__ import annotations


def test_chat_sessions_crud(client):
    created = client.post("/agent/chat/sessions", json={"title": "策略讨论"})
    assert created.status_code == 200
    detail = created.json()
    sid = detail["id"]
    assert detail["title"] == "策略讨论"
    assert detail["messages"] == []

    listed = client.get("/agent/chat/sessions")
    assert listed.status_code == 200
    items = listed.json()
    assert any(i["id"] == sid for i in items)

    got = client.get(f"/agent/chat/sessions/{sid}")
    assert got.status_code == 200
    assert got.json()["id"] == sid

    renamed = client.patch(f"/agent/chat/sessions/{sid}", json={"title": "研究会话"})
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "研究会话"

    deleted = client.delete(f"/agent/chat/sessions/{sid}")
    assert deleted.status_code == 204

    missing = client.get(f"/agent/chat/sessions/{sid}")
    assert missing.status_code == 404


def test_chat_stream_persists_on_done(client, monkeypatch):
    class _Chunk:
        def __init__(self, content: str) -> None:
            self.content = content

    class _FakeLlm:
        def stream(self, _messages):
            yield _Chunk("hello")
            yield _Chunk(" world")

    monkeypatch.setattr(
        "app.routers.agent_llm.build_chat_model_from_workspace_settings",
        lambda _settings: _FakeLlm(),
    )

    session = client.post("/agent/chat/sessions", json={"title": "自动保存"}).json()
    sid = session["id"]
    body = {
        "session_id": sid,
        "messages": [{"role": "user", "content": "ping"}],
    }
    res = client.post("/agent/chat/stream", json=body)
    assert res.status_code == 200
    assert '"done": true' in res.text

    detail = client.get(f"/agent/chat/sessions/{sid}").json()
    assert len(detail["messages"]) == 2
    assert detail["messages"][0] == {"role": "user", "content": "ping"}
    assert detail["messages"][1] == {"role": "assistant", "content": "hello world"}


def test_chat_stream_error_does_not_persist(client, monkeypatch):
    class _FakeBrokenLlm:
        def stream(self, _messages):
            raise RuntimeError("boom")

    monkeypatch.setattr(
        "app.routers.agent_llm.build_chat_model_from_workspace_settings",
        lambda _settings: _FakeBrokenLlm(),
    )

    session = client.post("/agent/chat/sessions", json={"title": "失败路径"}).json()
    sid = session["id"]
    body = {
        "session_id": sid,
        "messages": [{"role": "user", "content": "ping"}],
    }
    res = client.post("/agent/chat/stream", json=body)
    assert res.status_code == 200
    assert '"error":' in res.text

    detail = client.get(f"/agent/chat/sessions/{sid}").json()
    assert detail["messages"] == []
