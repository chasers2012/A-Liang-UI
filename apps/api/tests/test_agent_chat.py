from __future__ import annotations

from langchain_core.messages import AIMessage


def test_agent_chat_returns_assistant_text(client, monkeypatch):
    def fake_build():
        return object()

    def fake_stream(_llm, _messages, *, stage: str):
        assert stage == "chat"
        return AIMessage(content="hi from test")

    monkeypatch.setattr("agent.llm.build_chat_llm", fake_build)
    monkeypatch.setattr("agent.llm.stream_llm", fake_stream)

    r = client.post(
        "/agent/chat",
        json={
            "messages": [
                {"role": "user", "content": "hello"},
            ],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "assistant"
    assert data["content"] == "hi from test"


def test_agent_chat_stream_sse(client, monkeypatch):
    def fake_build():
        return object()

    def fake_iter(_llm, _messages, *, stage: str, force_stream: bool = False):
        assert stage == "chat"
        assert force_stream is True
        yield "hi"
        yield " there"

    monkeypatch.setattr("agent.llm.build_chat_llm", fake_build)
    monkeypatch.setattr("agent.llm.iter_llm_stream_text_deltas", fake_iter)

    r = client.post(
        "/agent/chat/stream",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("text/event-stream")
    body = r.text
    assert "hi" in body
    assert "there" in body
    assert '"done": true' in body
