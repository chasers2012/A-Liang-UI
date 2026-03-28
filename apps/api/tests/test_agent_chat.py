from __future__ import annotations


def test_agent_chat_stream_sse(client, monkeypatch):
    class _Chunk:
        def __init__(self, content: str) -> None:
            self.content = content

    class _FakeLlm:
        def stream(self, messages):
            assert len(messages) >= 1
            yield _Chunk("hi")
            yield _Chunk(" there")

    def fake_build(_settings):
        return _FakeLlm()

    monkeypatch.setattr(
        "app.routers.agent_llm.build_chat_model_from_workspace_settings",
        fake_build,
    )

    r = client.post(
        "/agent/chat/stream",
        json={
            "messages": [
                {"role": "user", "content": "hello"},
            ],
        },
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("text/event-stream")
    body = r.text
    assert "hi" in body
    assert "there" in body
    assert '"done": true' in body
