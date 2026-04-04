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

    archived = client.delete(f"/agent/chat/sessions/{sid}")
    assert archived.status_code == 204

    listed_after_archive = client.get("/agent/chat/sessions")
    assert listed_after_archive.status_code == 200
    assert all(i["id"] != sid for i in listed_after_archive.json())

    missing = client.get(f"/agent/chat/sessions/{sid}")
    assert missing.status_code == 404


def test_chat_sessions_archived_list_and_restore(client):
    created = client.post("/agent/chat/sessions", json={"title": "归档恢复测"})
    assert created.status_code == 200
    sid = created.json()["id"]

    archived = client.delete(f"/agent/chat/sessions/{sid}")
    assert archived.status_code == 204

    listed = client.get("/agent/chat/sessions/archived")
    assert listed.status_code == 200
    archived_items = listed.json()
    assert any(i["id"] == sid for i in archived_items)
    hit = next(i for i in archived_items if i["id"] == sid)
    assert hit.get("archived_at")

    restored = client.post(f"/agent/chat/sessions/{sid}/restore")
    assert restored.status_code == 200
    assert restored.json()["id"] == sid

    active = client.get("/agent/chat/sessions")
    assert active.status_code == 200
    assert any(i["id"] == sid for i in active.json())

    listed_after = client.get("/agent/chat/sessions/archived")
    assert listed_after.status_code == 200
    assert all(i["id"] != sid for i in listed_after.json())


def test_chat_sessions_archived_purge(client):
    created = client.post("/agent/chat/sessions", json={"title": "归档删除测"})
    assert created.status_code == 200
    sid = created.json()["id"]

    archived = client.delete(f"/agent/chat/sessions/{sid}")
    assert archived.status_code == 204

    purged = client.delete(f"/agent/chat/sessions/{sid}/archived")
    assert purged.status_code == 204

    listed_archived = client.get("/agent/chat/sessions/archived")
    assert listed_archived.status_code == 200
    assert all(i["id"] != sid for i in listed_archived.json())

    restore_missing = client.post(f"/agent/chat/sessions/{sid}/restore")
    assert restore_missing.status_code == 404


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
        "messages": [{"role": "user", "blocks": [{"kind": "text", "content": "ping"}]}],
    }
    res = client.post("/agent/chat/stream", json=body)
    assert res.status_code == 200
    assert '"done": true' in res.text

    detail = client.get(f"/agent/chat/sessions/{sid}").json()
    assert len(detail["messages"]) == 2
    assert detail["messages"][0]["role"] == "user"
    assert detail["messages"][0]["blocks"] == [{"kind": "text", "content": "ping"}]
    assert detail["messages"][1]["role"] == "assistant"
    assert detail["messages"][1]["blocks"] == [{"kind": "text", "content": "hello world"}]


def test_chat_stream_persists_tool_blocks(client, monkeypatch):
    from langchain_core.messages import AIMessage

    class _FakeLlmWithTools:
        def __init__(self) -> None:
            self._calls = 0

        def bind_tools(self, _tools):
            return self

        def invoke(self, _messages):
            self._calls += 1
            if self._calls == 1:
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "create_factor",
                            "id": "call_1",
                            "args": {"name": "X"},
                        }
                    ],
                )
            return AIMessage(content="done")

    class _FakeCreateFactorTool:
        name = "create_factor"

        def invoke(self, args):
            return {"ok": True, "name": args.get("name")}

    def fake_get_tools(_self):
        return {"create_factor": _FakeCreateFactorTool()}

    monkeypatch.setattr(
        "app.routers.agent_llm.build_chat_model_from_workspace_settings",
        lambda _s: _FakeLlmWithTools(),
    )
    monkeypatch.setattr(
        "app.chat.tool_registry.ChatToolRegistry.get_tools",
        fake_get_tools,
    )

    session = client.post("/agent/chat/sessions", json={"title": "工具持久化"}).json()
    sid = session["id"]
    res = client.post(
        "/agent/chat/stream",
        json={
            "session_id": sid,
            "messages": [
                {
                    "role": "user",
                    "blocks": [{"kind": "text", "content": "run tool"}],
                }
            ],
        },
    )
    assert res.status_code == 200
    assert '"tool_start"' in res.text

    detail = client.get(f"/agent/chat/sessions/{sid}").json()
    assert len(detail["messages"]) == 2
    assistant = detail["messages"][1]
    assert assistant["role"] == "assistant"
    assert isinstance(assistant.get("blocks"), list)
    assert len(assistant["blocks"]) >= 2
    assert assistant["blocks"][0]["kind"] == "text"
    assert assistant["blocks"][0]["content"] == "done"
    assert assistant["blocks"][1]["kind"] == "tool"
    assert assistant["blocks"][1]["call"]["name"] == "create_factor"
    assert assistant["blocks"][1]["call"]["status"] == "ok"


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
        "messages": [{"role": "user", "blocks": [{"kind": "text", "content": "ping"}]}],
    }
    res = client.post("/agent/chat/stream", json=body)
    assert res.status_code == 200
    assert '"error":' in res.text

    detail = client.get(f"/agent/chat/sessions/{sid}").json()
    # 用户消息在流开始前已落盘；助手因错误不落盘
    assert len(detail["messages"]) == 1
    user0 = detail["messages"][0]
    assert user0["role"] == "user"
    assert user0["blocks"] == [{"kind": "text", "content": "ping"}]
    uid = user0.get("id")
    assert isinstance(uid, str)
    assert uid
