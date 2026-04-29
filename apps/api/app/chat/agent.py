"""Chat streaming execution logic (LangGraph ReAct)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterable, Iterable
from typing import Any

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    ToolMessage,
)
from langchain_core.runnables.config import RunnableConfig
from langgraph.types import Command
from langgraph.typing import InputT

from app.chat.agents.main_agent import create_main_agent
from app.chat.events import (
    DeltaEvent,
    DoneEvent,
    ReasoningEvent,
    StreamEventAny,
    TextPayload,
    ToolEvent,
    ToolPayload,
)


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


def _format_run_segment_id(ns: Any) -> str | None:
    if not isinstance(ns, (list, tuple)):
        return None
    for item in ns:
        if not isinstance(item, str):
            continue
        if not item.startswith("tools:"):
            continue
        _, _, segment = item.partition(":")
        return segment or None
    return None


def _extract_tools_namespace_key(ns: Any) -> str | None:
    if not isinstance(ns, (list, tuple)):
        return None
    for item in ns:
        if isinstance(item, str) and item.startswith("tools:"):
            return item
    return None


def _should_skip_stream_chunk(metadata: Any) -> bool:
    if not isinstance(metadata, dict):
        return False
    if metadata.get("lc_source") == "summarization":
        return True
    return bool(metadata.get("silent_stream"))


def _collect_run_segment_mapping_from_task(
    chunk: dict[str, Any],
    run_segment_id_map: dict[str, str],
) -> None:
    payload = chunk.get("data")
    if not isinstance(payload, dict):
        return
    if payload.get("name") != "tools":
        return

    task_id = payload.get("id")
    if not isinstance(task_id, str) or not task_id:
        return

    tool_call = (payload.get("input") or {}).get("tool_call")
    if not isinstance(tool_call, dict):
        return
    tc_id = tool_call.get("id")
    if not isinstance(tc_id, str) or not tc_id:
        return

    ns_key = f"tools:{task_id}"
    run_segment_id_map[ns_key] = tc_id


def parse_messages(  # noqa: C901
    chunk: dict[str, Any],
    emitted_tool_event_keys: set[tuple[str, str]],
    pending_tool_starts: list[tuple[str, str | None, str]],
    run_segment_id_map: dict[str, str],
) -> Iterable[StreamEventAny]:
    raw_ns_key = _extract_tools_namespace_key(chunk.get("ns"))
    raw_segment_id = _format_run_segment_id(chunk.get("ns"))
    rsid = run_segment_id_map.get(raw_ns_key or "", raw_segment_id)
    chunk_data = chunk.get("data")
    if not isinstance(chunk_data, tuple) or len(chunk_data) != 2:
        return
    token, metadata = chunk_data
    # DeepAgents may emit internal summarization tokens during context compaction.
    # Also suppress internal tool-side model calls (e.g. code-review prechecks).
    if _should_skip_stream_chunk(metadata):
        return

    if isinstance(token, AIMessageChunk):
        reasoning = _ai_message_reasoning_content(token)
        if reasoning:
            yield ReasoningEvent(
                payload=TextPayload(
                    text=reasoning,
                    run_segment_id=rsid,
                )
            )

        if token.tool_call_chunks:
            # Per Deep Agents streaming docs, tool calls surface as tool_call_chunks.
            for tc in token.tool_call_chunks:
                name = tc.get("name")
                tc_id = tc.get("id")
                if not isinstance(tc_id, str) or not tc_id:
                    # Some early chunks may not carry a stable tool_call id yet.
                    # Skip until id is available to avoid invalid ToolPayload.
                    continue
                event_key = ("start", tc_id)
                if event_key in emitted_tool_event_keys:
                    continue
                emitted_tool_event_keys.add(event_key)
                event = ToolEvent(
                    payload=ToolPayload(
                        stage="start",
                        name=name,
                        id=tc_id,
                        args=tc.get("args"),
                        run_segment_id=rsid,
                    )
                )
                if event.payload.id:
                    normalized_args = _normalize_args_shape(event.payload.args)
                    pending_tool_starts.append(
                        (
                            event.payload.id,
                            event.payload.name,
                            _canonicalize_args(normalized_args),
                        )
                    )
                yield event

        text = _chunk_text(token.content)
        if text:
            yield DeltaEvent(
                payload=TextPayload(
                    text=text,
                    run_segment_id=rsid,
                )
            )
        return

    if isinstance(token, ToolMessage):
        tc_id = token.tool_call_id
        if not isinstance(tc_id, str) or not tc_id:
            return
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
                    run_segment_id=rsid,
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
                run_segment_id=rsid,
            )
        )


def parse_interrupt(
    data: Any,
    emitted_tool_event_keys: set[tuple[str, str]],
    pending_tool_starts: list[tuple[str, str | None, str]],
) -> list[ToolEvent] | None:
    """
    Parse interrupt payload from updates stream.

    Returns:
    - handled: whether the current updates chunk is an interrupt chunk
    - events: authorize tool events to emit; empty means terminate stream for this interrupt
    """
    events: list[ToolEvent] = []
    if not isinstance(data, dict) or "__interrupt__" not in data:
        return None
    try:
        interrupt_value = data["__interrupt__"][0].value
    except Exception:
        interrupt_value = data.get("__interrupt__")

    matched_ids = _match_tool_call_ids_from_pending(
        pending_tool_starts,
        interrupt_value,
    )
    if not matched_ids:
        return events

    for tc_id in matched_ids:
        event_key = ("authorize", tc_id)
        if event_key in emitted_tool_event_keys:
            continue
        emitted_tool_event_keys.add(event_key)
        events.append(
            ToolEvent(
                payload=ToolPayload(
                    stage="authorize",
                    id=tc_id,
                )
            )
        )
    return events


async def stream_event_aiter_for_chat(
    llm: Any,
    input: InputT | Command | None,
    *,
    config: RunnableConfig = None,
) -> AsyncIterable[StreamEventAny]:
    agent = await create_main_agent(model=llm)
    emitted_tool_event_keys: set[tuple[str, str]] = set()
    pending_tool_starts: list[tuple[str, str | None, str]] = []
    run_segment_id_map: dict[str, str] = {}

    async for chunk in agent.astream(
        input,
        config,
        stream_mode=["messages", "tasks", "updates"],
        subgraphs=True,
        version="v2",
    ):
        if not isinstance(chunk, dict):
            continue
        ctype = chunk.get("type")
        if ctype == "messages":
            for event in parse_messages(
                chunk,
                emitted_tool_event_keys,
                pending_tool_starts,
                run_segment_id_map,
            ):
                yield event
            continue

        if ctype == "tasks":
            _collect_run_segment_mapping_from_task(chunk, run_segment_id_map)
            continue

        if ctype == "updates":
            data = chunk.get("data")
            events = parse_interrupt(
                data,
                emitted_tool_event_keys,
                pending_tool_starts,
            )
            if not isinstance(events, list):
                continue
            if not events:
                return
            for event in events:
                yield event

    yield DoneEvent()
