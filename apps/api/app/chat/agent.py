"""Chat streaming execution logic (LangGraph ReAct)."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.chat.agents.main_agent import create_main_agent
from app.chat.events import (
    DeltaEvent,
    DoneEvent,
    ErrorEvent,
    ReasoningEvent,
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


def _ai_message_reasoning_content(message: AIMessage | AIMessageChunk) -> str:
    raw = message.additional_kwargs.get("reasoning_content")
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        parts: list[str] = []
        for item in raw:
            if isinstance(item, str):
                parts.append(item)
                continue
            if (
                isinstance(item, dict)
                and item.get("type") in ("text", "reasoning")
                and isinstance(item.get("text"), str)
            ):
                parts.append(item["text"])
        return "".join(parts)
    return ""


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
        # stream_mode="messages" carries incremental reasoning and text deltas.
        if isinstance(data, tuple) and data:
            chunk = data[0]
            if isinstance(chunk, AIMessageChunk):
                reasoning = _ai_message_reasoning_content(chunk)
                if reasoning:
                    yield ReasoningEvent(payload=reasoning)
                for tc in chunk.tool_calls:
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
            if isinstance(chunk, ToolMessage):
                tc_id = chunk.tool_call_id
                name = pending_tool_names.get(tc_id, "")
                if chunk.status == "error":
                    event_key = ("error", tc_id or name or "tool_call")
                    if event_key not in emitted_tool_event_keys:
                        emitted_tool_event_keys.add(event_key)
                        yield ToolEvent(
                            payload=ToolPayload(
                                stage="error",
                                name=name,
                                id=tc_id or name or "tool_call",
                                error=str(chunk.content),
                            )
                        )
                else:
                    result = chunk.artifact if chunk.artifact is not None else chunk.content
                    event_key = ("result", tc_id or name or "tool_call")
                    if event_key not in emitted_tool_event_keys:
                        emitted_tool_event_keys.add(event_key)
                        yield ToolEvent(
                            payload=ToolPayload(
                                stage="result",
                                name=name,
                                id=tc_id or name or "tool_call",
                                result=result,
                            )
                        )
        text = _stream_token_text(data)
        if text:
            yield DeltaEvent(payload=text)
        return
    return


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
            stream_mode=["messages"],
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
