from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from app.chat.chat_llm import stream_chunk_text
from app.chat.llm_schemas import ChatRequest
from app.chat.tool_registry import ChatToolRegistry
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

_MAX_TOOL_ROUNDS = 5


def lc_messages_from_chat_request(body: ChatRequest) -> list[BaseMessage]:
    lc_messages: list[BaseMessage] = []
    for m in body.messages:
        if m.role == "system":
            lc_messages.append(SystemMessage(content=m.content))
        elif m.role == "user":
            lc_messages.append(HumanMessage(content=m.content))
        else:
            lc_messages.append(AIMessage(content=m.content))
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


def sse_event_iter_for_chat(  # noqa: C901
    llm: Any,
    *,
    lc_messages: list[BaseMessage],
    max_tool_rounds: int = _MAX_TOOL_ROUNDS,
) -> Iterable[str]:
    tools = ChatToolRegistry.instance().get_tools()
    llm_with_tools = llm
    if tools and hasattr(llm, "bind_tools"):
        try:
            llm_with_tools = llm.bind_tools(list(tools.values()))
        except Exception:
            llm_with_tools = llm

    messages: list[BaseMessage] = list(lc_messages)

    try:
        for _round in range(int(max_tool_rounds)):
            ai: Any = llm_with_tools.invoke(messages) if hasattr(llm_with_tools, "invoke") else None
            if ai is None:
                # Fallback: pure streaming if invoke is unavailable.
                for chunk in llm.stream(messages):
                    piece = stream_chunk_text(chunk)
                    if piece:
                        yield _json_line({"delta": piece})
                yield _json_line({"done": True})
                return

            if not isinstance(ai, AIMessage):
                ai = AIMessage(content=getattr(ai, "content", str(ai)))

            tool_calls = list(getattr(ai, "tool_calls", []) or [])
            if not tool_calls:
                text = stream_chunk_text(ai)
                if text:
                    yield _json_line({"delta": text})
                yield _json_line({"done": True})
                return

            # Append the tool-requesting AIMessage, then execute tool calls.
            messages.append(ai)
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

        yield _json_line({"error": f"工具调用轮次超过上限（max={max_tool_rounds}）"})
        return
    except Exception as e:
        yield _json_line({"error": f"LLM 调用失败：{e}"})
        return
