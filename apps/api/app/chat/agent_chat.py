from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from app.chat.chat_llm import stream_chunk_text
from app.chat.llm_schemas import ChatRequest, assistant_message_text_for_model
from app.chat.tool_registry import ChatToolRegistry
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

_MAX_TOOL_ROUNDS = 10


def lc_messages_from_chat_request(body: ChatRequest) -> list[BaseMessage]:
    lc_messages: list[BaseMessage] = []
    for m in body.messages:
        if m.role == "system":
            lc_messages.append(SystemMessage(content=m.content))
        elif m.role == "user":
            lc_messages.append(HumanMessage(content=m.content))
        else:
            lc_messages.append(
                AIMessage(content=assistant_message_text_for_model(m)),
            )
    return lc_messages


def _json_line(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _tool_message_content(result: Any) -> str:
    # ToolMessage content is text; use JSON to preserve structure.
    if result is None:
        return "null"
    if hasattr(result, "model_dump"):
        try:
            return json.dumps(result.model_dump(), ensure_ascii=False)
        except Exception:
            return json.dumps(str(result), ensure_ascii=False)
    if isinstance(result, (dict, list, str, int, float, bool)):
        return json.dumps(result, ensure_ascii=False) if not isinstance(result, str) else result
    return json.dumps(str(result), ensure_ascii=False)


def _bind_tools_if_supported(llm: Any, tools: dict[str, Any]) -> Any:
    if not tools or not hasattr(llm, "bind_tools"):
        return llm
    try:
        return llm.bind_tools(list(tools.values()))
    except Exception:
        return llm


def _to_ai_message(value: Any) -> AIMessage:
    if isinstance(value, AIMessage):
        return value
    return AIMessage(
        content=stream_chunk_text(value) or str(getattr(value, "content", value)),
        tool_calls=list(getattr(value, "tool_calls", []) or []),
    )


def _stream_ai_with_deltas(
    llm_like: Any, messages: list[BaseMessage]
) -> tuple[AIMessage | None, bool]:
    if not hasattr(llm_like, "stream"):
        return None, False
    merged: Any | None = None
    emitted_text = False
    for chunk in llm_like.stream(messages):
        if merged is None:
            merged = chunk
        else:
            try:
                merged = merged + chunk
            except Exception:
                merged = chunk
        piece = stream_chunk_text(chunk)
        if piece:
            emitted_text = True
            yield _json_line({"delta": piece})
    return (_to_ai_message(merged) if merged is not None else None), emitted_text


def _call_model_once(
    *,
    llm_with_tools: Any,
    llm_raw: Any,
    messages: list[BaseMessage],
) -> tuple[AIMessage | None, bool]:
    # 1) Prefer stream to emit deltas.
    if hasattr(llm_with_tools, "stream"):
        streamed = yield from _stream_ai_with_deltas(llm_with_tools, messages)
        ai, emitted_text = streamed
        if ai is not None:
            return ai, emitted_text

    # 2) Fallback to invoke.
    if hasattr(llm_with_tools, "invoke"):
        return _to_ai_message(llm_with_tools.invoke(messages)), False

    # 3) Last fallback: raw model streaming.
    streamed = yield from _stream_ai_with_deltas(llm_raw, messages)
    ai, emitted_text = streamed
    return ai, emitted_text


def _run_tool_calls(
    *,
    tool_calls: list[dict[str, Any]],
    tools: dict[str, Any],
    messages: list[BaseMessage],
) -> Iterable[str]:
    for tc in tool_calls:
        name = (tc.get("name") or "").strip()
        tc_id = (tc.get("id") or "").strip() or name or "tool_call"
        raw_args = tc.get("args")
        yield _json_line({"tool_start": {"name": name, "id": tc_id, "args": raw_args}})

        tool = tools.get(name)
        if tool is None:
            err = f"不允许调用工具：{name}"
            yield _json_line({"tool_error": {"name": name, "id": tc_id, "error": err}})
            messages.append(
                ToolMessage(
                    tool_call_id=tc_id,
                    content=_tool_message_content({"error": err}),
                )
            )
            continue

        try:
            result = tool.invoke(raw_args)
            yield _json_line(
                {
                    "tool_result": {
                        "name": name,
                        "id": tc_id,
                        "result": json.loads(_tool_message_content(result))
                        if hasattr(result, "model_dump") or isinstance(result, (dict, list))
                        else result,
                    }
                }
            )
            messages.append(
                ToolMessage(
                    tool_call_id=tc_id,
                    content=_tool_message_content(result),
                )
            )
        except Exception as e:
            yield _json_line({"tool_error": {"name": name, "id": tc_id, "error": str(e)}})
            messages.append(
                ToolMessage(
                    tool_call_id=tc_id,
                    content=_tool_message_content({"error": str(e)}),
                )
            )


def sse_event_iter_for_chat(
    llm: Any,
    *,
    lc_messages: list[BaseMessage],
    max_tool_rounds: int = _MAX_TOOL_ROUNDS,
) -> Iterable[str]:
    tools = ChatToolRegistry.instance().get_tools()
    llm_with_tools = _bind_tools_if_supported(llm, tools)
    messages: list[BaseMessage] = list(lc_messages)

    try:
        for _round in range(int(max_tool_rounds)):
            ai, emitted_text = yield from _call_model_once(
                llm_with_tools=llm_with_tools,
                llm_raw=llm,
                messages=messages,
            )
            if ai is None:
                yield _json_line({"done": True})
                return

            tool_calls = list(getattr(ai, "tool_calls", []) or [])
            if not tool_calls:
                text = stream_chunk_text(ai)
                if text and not emitted_text:
                    yield _json_line({"delta": text})
                yield _json_line({"done": True})
                return

            # Append the tool-requesting AIMessage, then execute tool calls.
            messages.append(ai)
            yield from _run_tool_calls(tool_calls=tool_calls, tools=tools, messages=messages)

        yield _json_line({"error": f"工具调用轮次超过上限（max={max_tool_rounds}）"})
        return
    except Exception as e:
        yield _json_line({"error": f"LLM 调用失败：{e}"})
        return
