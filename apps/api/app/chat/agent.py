"""Chat streaming execution logic (LangGraph ReAct)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterable, Iterable
from typing import Any

from app.chat.agents.main_agent import create_main_agent
from app.chat.events import (
    DeltaEvent,
    DoneEvent,
    ErrorEvent,
    ReasoningEvent,
    StreamEventAny,
    TextPayload,
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
from langgraph.types import Command


def _canonicalize_args(value: Any) -> str:
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            try:
                value = json.loads(stripped)
            except Exception:
                # Keep raw string when not valid JSON.
                value = stripped
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    except Exception:
        return str(value)


def _normalize_args_shape(value: Any) -> Any:
    """Normalize args shape across tool_call_chunks and action_requests."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            try:
                value = json.loads(stripped)
            except Exception:
                return stripped
        else:
            return ""
    if isinstance(value, dict):
        # HITL action request often wraps original args under `args`.
        inner = value.get("args")
        if inner is not None:
            return _normalize_args_shape(inner)
    return value


def _extract_interrupt_action_requests(interrupt_data: Any) -> list[tuple[str, str]]:
    """Return [(tool_name, canonical_args), ...] from interrupt payload action_requests."""
    if not isinstance(interrupt_data, dict):
        return []
    action_requests = interrupt_data.get("action_requests")
    if not isinstance(action_requests, list) or not action_requests:
        return []
    requests: list[tuple[str, str]] = []
    for req in action_requests:
        if not isinstance(req, dict):
            continue
        name = req.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        args = _normalize_args_shape(req.get("args"))
        requests.append((name.strip(), _canonicalize_args(args)))
    return requests


def _match_tool_call_ids_from_pending(
    pending_starts: list[tuple[str, str | None, str]],
    interrupt_data: Any,
) -> list[str]:
    """Match tool call ids using interrupt action_requests name+args."""
    req_pairs = _extract_interrupt_action_requests(interrupt_data)
    if not req_pairs:
        return []

    remaining = pending_starts.copy()
    matched_ids: list[str] = []
    for req_name, req_args in req_pairs:
        for idx in range(len(remaining) - 1, -1, -1):
            tc_id, tc_name, tc_args = remaining[idx]
            if tc_name == req_name and tc_args == req_args:
                matched_ids.append(tc_id)
                remaining.pop(idx)
                break
    return matched_ids


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
    emitted_tool_event_keys: set[tuple[str, str]],
) -> Iterable[StreamEventAny]:

    token, metadata = chunk_data
    agent_name = None
    if isinstance(metadata, dict):
        raw_agent_name = metadata.get("lc_agent_name")
        if isinstance(raw_agent_name, str):
            agent_name = raw_agent_name.strip() or None
    # DeepAgents may emit internal summarization tokens during context compaction.
    # Keep this process transparent to users by not forwarding those chunks.
    if isinstance(metadata, dict) and metadata.get("lc_source") == "summarization":
        return

    if isinstance(token, AIMessageChunk):
        reasoning = _ai_message_reasoning_content(token)
        if reasoning:
            yield ReasoningEvent(
                payload=TextPayload(
                    text=reasoning,
                    agent_name=agent_name,
                )
            )

        if token.tool_call_chunks:
            # Per Deep Agents streaming docs, tool calls surface as tool_call_chunks.
            for tc in token.tool_call_chunks:
                name = tc.get("name")
                tc_id = tc.get("id")
                event_key = ("start", tc_id)
                if event_key in emitted_tool_event_keys:
                    continue
                emitted_tool_event_keys.add(event_key)
                yield ToolEvent(
                    payload=ToolPayload(
                        stage="start",
                        agent_name=agent_name,
                        name=name,
                        id=tc_id,
                        args=tc.get("args"),
                    )
                )

        text = _chunk_text(token.content)
        if text:
            yield DeltaEvent(
                payload=TextPayload(
                    text=text,
                    agent_name=agent_name,
                )
            )
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
                agent_name=agent_name,
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
            agent_name=agent_name,
            id=tc_id,
            result=result,
        )
    )
    return


async def _stream_events_from_agent_astream(  # noqa: C901
    agent: Any,
    *,
    astream_input: Any,
    max_tool_rounds: int,
    configurable: dict[str, Any],
) -> AsyncIterable[StreamEventAny]:
    emitted_tool_event_keys: set[tuple[str, str]] = set()
    pending_tool_starts: list[tuple[str, str | None, str]] = []

    async for chunk in agent.astream(
        astream_input,
        {
            "recursion_limit": max_tool_rounds * 2,
            "configurable": configurable,
        },
        stream_mode=["messages", "updates"],
        subgraphs=True,
        version="v2",
    ):
        if not isinstance(chunk, dict):
            continue
        ctype = chunk.get("type")
        if ctype == "messages":
            for event in _iter_stream_events_from_mode_data(
                chunk.get("data"),
                emitted_tool_event_keys,
            ):
                if (
                    isinstance(event, ToolEvent)
                    and event.payload.stage == "start"
                    and event.payload.id
                ):
                    normalized_args = _normalize_args_shape(event.payload.args)
                    pending_tool_starts.append(
                        (
                            event.payload.id,
                            event.payload.name,
                            _canonicalize_args(normalized_args),
                        )
                    )
                yield event
            continue

        if ctype == "updates":
            data = chunk.get("data") or {}
            if isinstance(data, dict) and "__interrupt__" in data:
                try:
                    interrupt_value = data["__interrupt__"][0].value
                except Exception:
                    interrupt_value = data.get("__interrupt__")
                matched_ids = _match_tool_call_ids_from_pending(
                    pending_tool_starts,
                    interrupt_value,
                )
                if not matched_ids:
                    return
                for tc_id in matched_ids:
                    event_key = ("authorize", tc_id)
                    if event_key in emitted_tool_event_keys:
                        continue
                    emitted_tool_event_keys.add(event_key)
                    yield ToolEvent(
                        payload=ToolPayload(
                            stage="authorize",
                            id=tc_id,
                        )
                    )
                return
            continue

    yield DoneEvent()


async def stream_event_aiter_for_chat(
    llm: Any,
    *,
    chat_messages: list[ChatMessageIn] | None = None,
    decision: dict[str, Any] | None = None,
    max_tool_rounds: int | None = None,
    thread_id: str | None = None,
) -> AsyncIterable[StreamEventAny]:
    if max_tool_rounds is None:
        from app.chat.schemas import LlmSettings

        max_tool_rounds = LlmSettings().max_tool_rounds

    use_resume = decision is not None
    if use_resume:
        tid = (thread_id or "").strip()
        if not tid:
            yield ErrorEvent(payload="thread_id 不能为空")
            return
    elif chat_messages is None:
        yield ErrorEvent(payload="chat_messages 不能为空")
        return

    try:
        agent = await create_main_agent(model=llm)
    except Exception as e:
        yield ErrorEvent(payload=f"初始化失败：{e}")
        return

    astream_input: Any
    configurable = {"thread_id": thread_id} if thread_id else {}
    if use_resume:
        # HumanInTheLoopMiddleware expects resume payload shape:
        # {"decisions": [{"type": "approve" | "reject" | ...}]}
        decision_data = decision or {}
        if isinstance(decision_data.get("decisions"), list):
            astream_input = Command(resume={"decisions": decision_data["decisions"]})
        else:
            yield ErrorEvent(payload="授权续跑失败：缺少有效 decisions")
            return
        configurable = {"thread_id": tid}
    else:
        astream_input = {"messages": _lc_messages_from_chat_messages(chat_messages or [])}

    try:
        async for event in _stream_events_from_agent_astream(
            agent,
            astream_input=astream_input,
            max_tool_rounds=max_tool_rounds,
            configurable=configurable,
        ):
            yield event
    except Exception as e:
        yield ErrorEvent(payload=f"LLM 调用失败：{e}")
        return
