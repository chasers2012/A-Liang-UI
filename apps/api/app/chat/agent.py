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
    AnyMessage,
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
    chunk_data: tuple[AnyMessage, dict[str, Any]],
    pending_tool_names: dict[str, str],
    emitted_tool_event_keys: set[tuple[str, str]],
) -> Iterable[StreamEventAny]:

    token, _metadata = chunk_data

    if isinstance(token, AIMessageChunk):
        reasoning = _ai_message_reasoning_content(token)
        if reasoning:
            yield ReasoningEvent(payload=reasoning)

        if token.tool_call_chunks:
            # Per Deep Agents streaming docs, tool calls surface as tool_call_chunks.
            for tc in token.tool_call_chunks:
                name = tc.get("name")
                tc_id = tc.get("id")
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

        text = _chunk_text(token.content)
        if text:
            yield DeltaEvent(payload=text)
        return

    if not isinstance(token, ToolMessage):
        return

    tc_id = token.tool_call_id
    if token.status == "error":
        event_key = ("error", tc_id)
        if event_key in emitted_tool_event_keys:
            return
        emitted_tool_event_keys.add(event_key)
        yield ToolEvent(
            payload=ToolPayload(
                stage="error",
                id=tc_id,
                error=str(token.content),
            )
        )
        return

    result = token.artifact if token.artifact is not None else token.content
    event_key = ("result", tc_id)
    if event_key in emitted_tool_event_keys:
        return
    emitted_tool_event_keys.add(event_key)
    yield ToolEvent(
        payload=ToolPayload(
            stage="result",
            id=tc_id,
            result=result,
        )
    )
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
        yield ErrorEvent(payload=f"初始化失败：{e}")
        return

    try:
        pending_tool_names: dict[str, str] = {}
        emitted_tool_event_keys: set[tuple[str, str]] = set()
        for chunk in agent.stream(
            {"messages": lc_messages},
            {"recursion_limit": max_tool_rounds * 2},
            stream_mode=["messages"],
            subgraphs=True,
            version="v2",
        ):
            if not isinstance(chunk, dict):
                continue
            if chunk.get("type") != "messages":
                continue

            yield from _iter_stream_events_from_mode_data(
                chunk.get("data"),
                pending_tool_names,
                emitted_tool_event_keys,
            )
        yield DoneEvent()
    except Exception as e:
        yield ErrorEvent(payload=f"LLM 调用失败：{e}")
        return
