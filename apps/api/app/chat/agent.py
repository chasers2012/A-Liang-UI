"""Chat streaming execution logic (LangGraph ReAct)."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.chat.agents.main_agent import create_main_agent
from app.chat.events import (
    DeltaEvent,
    DoneEvent,
    ErrorEvent,
    StreamEventAny,
    ToolEvent,
    ToolPayload,
)
from app.chat.schemas import ChatMessageIn, message_text_for_model
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

_MAX_TOOL_ROUNDS = 10


def _chunk_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    parts: list[str] = []
    if isinstance(content, list):
        for block in content:
            if isinstance(block, str):
                parts.append(block)
                continue
            if (
                isinstance(block, dict)
                and block.get("type") == "text"
                and isinstance(block.get("text"), str)
            ):
                parts.append(block["text"])
    return "".join(parts)


def _stream_token_text(item: Any) -> str:
    # stream_mode="messages" yields (message_chunk, metadata)
    if not isinstance(item, tuple) or not item:
        return ""
    chunk = item[0]
    if not isinstance(chunk, AIMessageChunk):
        return ""
    return _chunk_text(chunk.content)


def _messages_from_updates_payload(payload: Any) -> list[BaseMessage]:
    if not isinstance(payload, dict):
        return []
    messages: list[BaseMessage] = []
    for node_update in payload.values():
        if not isinstance(node_update, dict):
            continue
        maybe_messages = node_update.get("messages")
        if not isinstance(maybe_messages, list):
            continue
        for msg in maybe_messages:
            if isinstance(msg, BaseMessage):
                messages.append(msg)
    return messages


def _lc_messages_from_chat_messages(messages: list[ChatMessageIn]) -> list[BaseMessage]:
    lc_messages: list[BaseMessage] = []
    for m in messages:
        text = message_text_for_model(m)
        if m.role == "system":
            lc_messages.append(SystemMessage(content=text))
        elif m.role == "user":
            lc_messages.append(HumanMessage(content=text))
        else:
            lc_messages.append(AIMessage(content=text))
    return lc_messages


def _iter_stream_events_from_mode_data(  # noqa: C901
    mode: str,
    data: Any,
    pending_tool_names: dict[str, str],
    emitted_tool_event_keys: set[tuple[str, str]],
) -> Iterable[StreamEventAny]:
    if mode == "messages":
        text = _stream_token_text(data)
        if text:
            yield DeltaEvent(payload=text)
        return
    if mode != "updates":
        return

    for msg in _messages_from_updates_payload(data):
        if isinstance(msg, AIMessage):
            for tc in msg.tool_calls:
                name = tc.get("name") or ""
                tc_id = str(tc.get("id") or "") or name or "tool_call"
                pending_tool_names[tc_id] = name
                event_key = ("start", tc_id)
                if event_key in emitted_tool_event_keys:
                    continue
                emitted_tool_event_keys.add(event_key)
                yield ToolEvent(
                    payload=ToolPayload(
                        stage="start",
                        name=name,
                        id=tc_id,
                        args=tc.get("args"),
                    )
                )
            continue

        if isinstance(msg, ToolMessage):
            tc_id = msg.tool_call_id
            name = pending_tool_names.get(tc_id, "")
            if msg.status == "error":
                event_key = ("error", tc_id or name or "tool_call")
                if event_key in emitted_tool_event_keys:
                    continue
                emitted_tool_event_keys.add(event_key)
                yield ToolEvent(
                    payload=ToolPayload(
                        stage="error",
                        name=name,
                        id=tc_id or name or "tool_call",
                        error=str(msg.content),
                    )
                )
            else:
                result = msg.artifact if msg.artifact is not None else msg.content
                event_key = ("result", tc_id or name or "tool_call")
                if event_key in emitted_tool_event_keys:
                    continue
                emitted_tool_event_keys.add(event_key)
                yield ToolEvent(
                    payload=ToolPayload(
                        stage="result",
                        name=name,
                        id=tc_id or name or "tool_call",
                        result=result,
                    )
                )


def stream_event_iter_for_chat(
    llm: Any,
    *,
    chat_messages: list[ChatMessageIn],
    max_tool_rounds: int = _MAX_TOOL_ROUNDS,
) -> Iterable[StreamEventAny]:
    lc_messages = _lc_messages_from_chat_messages(chat_messages)

    try:
        agent = create_main_agent(model=llm)
    except Exception as e:
        yield ErrorEvent(payload=f"ReAct 初始化失败：{e}")
        return

    try:
        pending_tool_names: dict[str, str] = {}
        emitted_tool_event_keys: set[tuple[str, str]] = set()
        for item in agent.stream(
            {"messages": lc_messages},
            {"recursion_limit": max_tool_rounds * 2},
            stream_mode=["messages", "updates"],
            subgraphs=True,
        ):
            if not isinstance(item, tuple):
                continue
            if len(item) == 3 and isinstance(item[1], str):
                _, mode, data = item
            elif len(item) == 2 and isinstance(item[0], str):
                mode, data = item
            else:
                continue
            yield from _iter_stream_events_from_mode_data(
                mode,
                data,
                pending_tool_names,
                emitted_tool_event_keys,
            )
        yield DoneEvent()
    except Exception as e:
        yield ErrorEvent(payload=f"LLM 调用失败：{e}")
        return
