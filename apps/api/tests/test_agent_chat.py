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


def test_agent_chat_stream_sse_tool_calls(client, monkeypatch):
    from langchain_core.messages import AIMessage

    class _FakeLlmWithTools:
        def __init__(self) -> None:
            self._calls = 0

        def bind_tools(self, _tools):
            return self

        def invoke(self, messages):
            # First round: request tool call. Second round: produce final text.
            self._calls += 1
            if self._calls == 1:
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "create_factor",
                            "id": "call_1",
                            "args": {
                                "name": "MyFactor",
                                "group": "custom",
                                "description": "d",
                                "max_window": 2,
                                "dependencies": ["close"],
                                # Intentionally omit source to test tool fallback.
                            },
                        }
                    ],
                )
            return AIMessage(content="created")

        def stream(self, messages):
            # Should not be used in this path (we have invoke), but keep for compatibility.
            yield AIMessage(content="created")

    def fake_build(_settings):
        return _FakeLlmWithTools()

    def fake_tool_invoke(args):
        # Return minimal object; SSE tool_result should include it.
        return {"ok": True, "name": args.get("name")}

    monkeypatch.setattr(
        "app.routers.agent_llm.build_chat_model_from_workspace_settings",
        fake_build,
    )
    monkeypatch.setattr(
        "app.factors.tools.create_factor.invoke",
        fake_tool_invoke,
    )

    r = client.post(
        "/agent/chat/stream",
        json={
            "messages": [
                {"role": "user", "content": "create factor"},
            ],
        },
    )
    assert r.status_code == 200
    body = r.text
    assert '"tool_start"' in body
    assert '"tool_result"' in body
    assert '"done": true' in body
    assert "created" in body
