"""Chat streaming execution logic (LangGraph ReAct)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterable, Iterable
from typing import Any

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    ToolMessage,
)
from langchain_core.runnables.config import RunnableConfig
from langgraph.types import Command
from langgraph.typing import InputT

from app.infra.stream.events import (
    DeltaEvent,
    DoneEvent,
    ReasoningEvent,
    StreamEventAny,
    TextPayload,
    ToolEvent,
    ToolPayload,
)
from app.packages.agents import create_main_agent


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


def _reasoning_from_content_blocks(blocks: Any) -> str:
    # LangChain standard content blocks may carry reasoning tokens in
    # `{"type": "reasoning", "reasoning": "..."}` entries.
    if not isinstance(blocks, list):
        return ""
    parts: list[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if block.get("type") != "reasoning":
            continue
        reasoning_text = block.get("reasoning")
        if isinstance(reasoning_text, str):
            parts.append(reasoning_text)
            continue
        text = block.get("text")
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts)


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


def _message_tool_calls(message: BaseMessage) -> list[dict[str, Any]]:
    if isinstance(message, AIMessage):
        tool_calls = getattr(message, "tool_calls", None)
        if isinstance(tool_calls, list):
            return [tc for tc in tool_calls if isinstance(tc, dict)]
    return []


def _updates_message_tool_events(
    message: BaseMessage,
    pending_tool_starts: list[tuple[str, str | None, str]],
    run_segment_id: str | None,
) -> Iterable[StreamEventAny]:
    for tool_call in _message_tool_calls(message):
        tc_id = tool_call.get("id")
        if not isinstance(tc_id, str) or not tc_id:
            continue
        name = tool_call.get("name")
        args = _normalize_args_shape(tool_call.get("args"))
        pending_tool_starts.append(
            (
                tc_id,
                name if isinstance(name, str) else None,
                _canonicalize_args(args),
            )
        )
        yield ToolEvent(
            payload=ToolPayload(
                stage="start",
                name=name if isinstance(name, str) else None,
                id=tc_id,
                args=args,
                run_segment_id=run_segment_id,
            )
        )


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


def _resolve_run_segment_id(
    chunk: dict[str, Any],
    run_segment_id_map: dict[str, str],
) -> str | None:
    raw_ns_key = _extract_tools_namespace_key(chunk.get("ns"))
    raw_segment_id = _format_run_segment_id(chunk.get("ns"))
    if raw_ns_key:
        mapped = run_segment_id_map.get(raw_ns_key)
        if mapped is not None:
            return mapped
    if raw_segment_id:
        return run_segment_id_map.get(raw_segment_id)
    return None


def parse_messages(
    chunk: dict[str, Any],
    rsid: str | None,
) -> Iterable[StreamEventAny]:
    chunk_data = chunk.get("data")
    if not isinstance(chunk_data, tuple) or len(chunk_data) != 2:
        return
    token, metadata = chunk_data
    # DeepAgents may emit internal summarization tokens during context compaction.
    # Also suppress internal tool-side model calls (e.g. code-review prechecks).
    if _should_skip_stream_chunk(metadata):
        return

    if not isinstance(token, AIMessageChunk):
        return
    reasoning = _reasoning_from_content_blocks(getattr(token, "content_blocks", None))
    if reasoning:
        yield ReasoningEvent(
            payload=TextPayload(
                text=reasoning,
                run_segment_id=rsid,
            )
        )

    text = _chunk_text(token.content)
    if text:
        yield DeltaEvent(
            payload=TextPayload(
                text=text,
                run_segment_id=rsid,
            )
        )
    return


def _parse_updates_tool_events(
    data: Any,
    pending_tool_starts: list[tuple[str, str | None, str]],
    rsid: str | None,
) -> list[ToolEvent] | None:
    if not isinstance(data, dict):
        return None

    events: list[ToolEvent] = []
    for source, update in data.items():
        if source not in ("model", "tools"):
            continue
        if not isinstance(update, dict):
            continue
        messages = update.get("messages")
        if not isinstance(messages, list) or not messages:
            continue
        last_message = messages[-1]
        if isinstance(last_message, ToolMessage):
            tc_id = last_message.tool_call_id
            if not isinstance(tc_id, str) or not tc_id:
                continue
            if last_message.status == "error":
                events.append(
                    ToolEvent(
                        payload=ToolPayload(
                            stage="error",
                            id=tc_id,
                            error=str(last_message.content),
                        )
                    )
                )
                continue
            result = (
                last_message.artifact if last_message.artifact is not None else last_message.content
            )
            events.append(
                ToolEvent(
                    payload=ToolPayload(
                        stage="result",
                        id=tc_id,
                        result=result,
                    )
                )
            )
            continue

        events.extend(
            _updates_message_tool_events(
                last_message,
                pending_tool_starts,
                rsid,
            )
        )

    return events


def _extract_interrupt_action_requests_from_updates(data: Any) -> Any:
    if not isinstance(data, dict):
        return None
    interrupt = data.get("__interrupt__")
    if interrupt is None:
        return None
    if isinstance(interrupt, list) and interrupt:
        first = interrupt[0]
        return getattr(first, "value", first)
    return interrupt


def parse_interrupt_updates(
    data: Any,
    pending_tool_starts: list[tuple[str, str | None, str]],
) -> list[ToolEvent] | None:
    interrupt_data = _extract_interrupt_action_requests_from_updates(data)
    if interrupt_data is None:
        return None

    matched_ids = _match_tool_call_ids_from_pending(
        pending_tool_starts,
        interrupt_data,
    )
    if not matched_ids:
        return []

    events: list[ToolEvent] = []
    interrupt_requests = _extract_interrupt_action_requests(interrupt_data)
    for idx, tc_id in enumerate(matched_ids):
        name = None
        args = None
        if idx < len(interrupt_requests):
            name, args = interrupt_requests[idx]
        events.append(
            ToolEvent(
                payload=ToolPayload(
                    stage="authorize",
                    id=tc_id,
                    name=name,
                    args=_normalize_args_shape(args),
                )
            )
        )
    return events


def parse_update(
    data: Any,
    pending_tool_starts: list[tuple[str, str | None, str]],
    rsid: str | None,
) -> list[ToolEvent]:
    interrupt_events = parse_interrupt_updates(data, pending_tool_starts)
    if interrupt_events:
        return interrupt_events

    events = _parse_updates_tool_events(data, pending_tool_starts, rsid)
    if not isinstance(events, list):
        return []
    return events


async def stream_event_aiter_for_chat(
    llm: Any,
    input: InputT | Command | None,
    *,
    config: RunnableConfig = None,
) -> AsyncIterable[StreamEventAny]:
    agent = await create_main_agent(model=llm)
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
        rsid = _resolve_run_segment_id(chunk, run_segment_id_map)

        ctype = chunk.get("type")
        if ctype == "messages":
            for event in parse_messages(
                chunk,
                rsid,
            ):
                yield event
            continue

        if ctype == "tasks":
            _collect_run_segment_mapping_from_task(chunk, run_segment_id_map)
            continue

        if ctype == "updates":
            events = parse_update(
                chunk.get("data"),
                pending_tool_starts,
                rsid,
            )
            for event in events:
                yield event

    yield DoneEvent()
