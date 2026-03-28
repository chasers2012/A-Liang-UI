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
