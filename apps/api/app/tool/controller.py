"""Tool-calling controller: execute model + tool call rounds for chat SSE."""

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage

from app.tool.registry import ChatToolRegistry

_MAX_TOOL_ROUNDS = 10


class EventBuilder:
    @staticmethod
    def json_line(payload: dict[str, Any]) -> str:
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    @classmethod
    def delta(cls, text: str) -> str:
        return cls.json_line({"delta": text})

    @classmethod
    def done(cls) -> str:
        return cls.json_line({"done": True})

    @classmethod
    def error(cls, message: str) -> str:
        return cls.json_line({"error": message})

    @classmethod
    def tool_start(cls, *, name: str, tc_id: str, args: Any) -> str:
        return cls.json_line({"tool_start": {"name": name, "id": tc_id, "args": args}})

    @classmethod
    def tool_result(cls, *, name: str, tc_id: str, result: Any) -> str:
        return cls.json_line(
            {
                "tool_result": {
                    "name": name,
                    "id": tc_id,
                    "result": result,
                }
            }
        )

    @classmethod
    def tool_error(cls, *, name: str, tc_id: str, error: str) -> str:
        return cls.json_line({"tool_error": {"name": name, "id": tc_id, "error": error}})


class ToolRunner:
    def __init__(self, tools: dict[str, Any], event_builder: EventBuilder) -> None:
        self._tools = tools
        self._event_builder = event_builder

    @staticmethod
    def _tool_message_content(result: Any) -> str:
        if result is None:
            return "null"
        if isinstance(result, str):
            return result
        if isinstance(result, (dict, list, int, float, bool)):
            return json.dumps(result, ensure_ascii=False)
        return json.dumps(str(result), ensure_ascii=False)

    def run_tool_calls(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        messages: list[BaseMessage],
    ) -> Iterable[str]:
        for tc in tool_calls:
            name = (tc.get("name") or "").strip()
            tc_id = (tc.get("id") or "").strip() or name or "tool_call"
            raw_args = tc.get("args")
            yield self._event_builder.tool_start(name=name, tc_id=tc_id, args=raw_args)

            tool = self._tools.get(name)
            try:
                if tool is None:
                    raise ValueError(f"不允许调用工具：{name}")
                result = tool.invoke(raw_args)
                tool_content = self._tool_message_content(result)
                event_result = result if isinstance(result, (dict, list)) else tool_content
                yield self._event_builder.tool_result(name=name, tc_id=tc_id, result=event_result)
                messages.append(ToolMessage(tool_call_id=tc_id, content=tool_content))
            except Exception as e:
                err = str(e)
                yield self._event_builder.tool_error(name=name, tc_id=tc_id, error=err)
                tool_content = self._tool_message_content({"error": err})
                messages.append(ToolMessage(tool_call_id=tc_id, content=tool_content))


@dataclass
class _ModelCallResult:
    ai: AIMessage | None
    emitted_text: bool


class ToolController:
    def __init__(
        self,
        *,
        tool_registry: ChatToolRegistry | None = None,
        max_tool_rounds: int = _MAX_TOOL_ROUNDS,
        event_builder: EventBuilder | None = None,
    ) -> None:
        self._registry = tool_registry or ChatToolRegistry.instance()
        self._max_tool_rounds = int(max_tool_rounds)
        self._event_builder = event_builder or EventBuilder()

    @staticmethod
    def stream_chunk_text(chunk: Any) -> str:
        c = getattr(chunk, "content", chunk)
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            parts: list[str] = []
            for block in c:
                if (isinstance(block, dict) and "text" in block) or (
                    isinstance(block, dict) and block.get("type") == "text" and block.get("text")
                ):
                    parts.append(str(block["text"]))
                elif isinstance(block, str):
                    parts.append(block)
            return "".join(parts)
        return str(c) if c is not None else ""

    def _bind_tools_if_supported(self, llm: Any, tools: dict[str, Any]) -> Any:
        if not tools or not hasattr(llm, "bind_tools"):
            return llm
        try:
            return llm.bind_tools(list(tools.values()))
        except Exception:
            return llm

    def _to_ai_message(self, value: Any) -> AIMessage:
        if isinstance(value, AIMessage):
            return value
        return AIMessage(
            content=self.stream_chunk_text(value) or str(getattr(value, "content", value)),
            tool_calls=list(getattr(value, "tool_calls", []) or []),
        )

    def _stream_ai_with_deltas(self, llm_like: Any, messages: list[BaseMessage]) -> Iterable[str]:
        if not hasattr(llm_like, "stream"):
            return
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
            piece = self.stream_chunk_text(chunk)
            if piece:
                emitted_text = True
                yield self._event_builder.delta(piece)
        return (self._to_ai_message(merged) if merged is not None else None), emitted_text

    def _call_model_once(
        self,
        *,
        llm_with_tools: Any,
        llm_raw: Any,
        messages: list[BaseMessage],
    ) -> Iterable[str] | _ModelCallResult:
        if hasattr(llm_with_tools, "stream"):
            streamed = yield from self._stream_ai_with_deltas(llm_with_tools, messages)
            ai, emitted_text = streamed
            if ai is not None:
                return _ModelCallResult(ai=ai, emitted_text=emitted_text)

        if hasattr(llm_with_tools, "invoke"):
            return _ModelCallResult(
                ai=self._to_ai_message(llm_with_tools.invoke(messages)), emitted_text=False
            )

        streamed = yield from self._stream_ai_with_deltas(llm_raw, messages)
        ai, emitted_text = streamed
        return _ModelCallResult(ai=ai, emitted_text=emitted_text)

    def _iter_sse_events_for_chat(self, llm: Any, lc_messages: list[BaseMessage]) -> Iterable[str]:
        tools = self._registry.get_tools()
        llm_with_tools = self._bind_tools_if_supported(llm, tools)
        messages = list(lc_messages)
        tool_runner = ToolRunner(tools, self._event_builder)

        try:
            for _round in range(self._max_tool_rounds):
                model_result = yield from self._call_model_once(
                    llm_with_tools=llm_with_tools,
                    llm_raw=llm,
                    messages=messages,
                )
                ai = model_result.ai
                emitted_text = model_result.emitted_text
                if ai is None:
                    yield self._event_builder.done()
                    return

                tool_calls = list(getattr(ai, "tool_calls", []) or [])
                if not tool_calls:
                    text = self.stream_chunk_text(ai)
                    if text and not emitted_text:
                        yield self._event_builder.delta(text)
                    yield self._event_builder.done()
                    return

                messages.append(ai)
                yield from tool_runner.run_tool_calls(tool_calls=tool_calls, messages=messages)

            yield self._event_builder.error(f"工具调用轮次超过上限（max={self._max_tool_rounds}）")
            return
        except Exception as e:
            yield self._event_builder.error(f"LLM 调用失败：{e}")
            return

    @classmethod
    def sse_event_iter_for_chat(
        cls,
        llm: Any,
        *,
        lc_messages: list[BaseMessage],
        max_tool_rounds: int = _MAX_TOOL_ROUNDS,
    ) -> Iterable[str]:
        controller = cls(max_tool_rounds=max_tool_rounds)
        yield from controller._iter_sse_events_for_chat(llm=llm, lc_messages=lc_messages)
