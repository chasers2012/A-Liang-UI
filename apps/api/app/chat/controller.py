"""Chat module controller: orchestrates LLM/chat-session business logic."""

from __future__ import annotations

import json
import queue
import threading
import uuid
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from typing import Any

from app.chat.registry import (
    ChatRegistry,
    record_to_archived_summary,
    record_to_detail,
    record_to_summary,
)
from app.chat.schemas import (
    AssistantBlockPublic,
    ChatArchivedSummaryPublic,
    ChatCreateBody,
    ChatDetailPublic,
    ChatMessageIn,
    ChatRecord,
    ChatRenameBody,
    ChatRequest,
    ChatSummaryPublic,
    ChatToolCallPublic,
    LlmSettings,
    ensure_chat_message_id,
    message_text_for_model,
)
from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator
from app.tool.controller import ToolController
from app.workspace_config import load_workspace_config, save_workspace_config
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

_CONFIG_FILE = "agent/llm.json"
MAX_SESSION_MESSAGES = 200
_CHAT_ID_GENERATOR = create_id_generator("ChatRegistry")
_MAX_TOOL_ROUNDS = 10


def build_chat_model_from_workspace_settings(
    settings: LlmSettings,
) -> BaseChatModel:
    temperature = settings.temperature
    provider = settings.provider if settings.provider in ("ollama", "openai") else "ollama"
    model = settings.model.strip() if settings.model else "qwen3.5:9b"

    if provider == "openai":
        api_key = (settings.api_key or "").strip() or None
        if not api_key:
            raise ValueError(
                "OpenAI 提供方需要 API 密钥：在 Web Agent 页面保存 api_key"
                "（写入 config/agent_llm.json）。"
            )
        openai_kwargs: dict[str, Any] = {
            "temperature": temperature,
            "api_key": api_key,
        }
        ob = (settings.openai_base_url or "").strip()
        if ob:
            openai_kwargs["base_url"] = ob.rstrip("/")
        return init_chat_model(f"openai:{model}", **openai_kwargs)

    timeout = settings.ollama_timeout
    num_predict = settings.ollama_num_predict
    base_url = (settings.ollama_base_url or "").strip()
    reasoning = settings.ollama_reasoning

    client_kwargs: dict[str, Any] = {"timeout": timeout}
    kwargs: dict[str, Any] = {
        "temperature": temperature,
        "base_url": base_url.rstrip("/"),
        "num_predict": num_predict,
        "client_kwargs": client_kwargs,
    }
    if reasoning is not None:
        kwargs["reasoning"] = reasoning

    return init_chat_model(f"ollama:{model}", **kwargs)


def lc_messages_from_chat_messages(messages: list[ChatMessageIn]) -> list[BaseMessage]:
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


def _defaults() -> LlmSettings:
    return LlmSettings()


def _build_llm_from_workspace():
    settings = load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )
    return build_chat_model_from_workspace_settings(settings)


class _StreamEventBuilder:
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
        return cls.json_line({"tool_result": {"name": name, "id": tc_id, "result": result}})

    @classmethod
    def tool_error(cls, *, name: str, tc_id: str, error: str) -> str:
        return cls.json_line({"tool_error": {"name": name, "id": tc_id, "error": error}})


@dataclass
class _ModelCallResult:
    ai: AIMessage | None
    emitted_text: bool


def _stream_chunk_text(chunk: Any) -> str:
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


def _tool_message_content(result: Any) -> str:
    if result is None:
        return "null"
    if isinstance(result, str):
        return result
    if isinstance(result, (dict, list, int, float, bool)):
        return json.dumps(result, ensure_ascii=False)
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
        content=_stream_chunk_text(value) or str(getattr(value, "content", value)),
        tool_calls=list(getattr(value, "tool_calls", []) or []),
    )


def _stream_ai_with_deltas(
    llm_like: Any,
    messages: list[BaseMessage],
    event_builder: _StreamEventBuilder,
) -> Iterable[str]:
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
        piece = _stream_chunk_text(chunk)
        if piece:
            emitted_text = True
            yield event_builder.delta(piece)
    return (_to_ai_message(merged) if merged is not None else None), emitted_text


def _call_model_once(
    *,
    llm_with_tools: Any,
    llm_raw: Any,
    messages: list[BaseMessage],
    event_builder: _StreamEventBuilder,
) -> Iterable[str] | _ModelCallResult:
    if hasattr(llm_with_tools, "stream"):
        streamed = yield from _stream_ai_with_deltas(llm_with_tools, messages, event_builder)
        ai, emitted_text = streamed
        if ai is not None:
            return _ModelCallResult(ai=ai, emitted_text=emitted_text)

    if hasattr(llm_with_tools, "invoke"):
        return _ModelCallResult(
            ai=_to_ai_message(llm_with_tools.invoke(messages)), emitted_text=False
        )

    streamed = yield from _stream_ai_with_deltas(llm_raw, messages, event_builder)
    ai, emitted_text = streamed
    return _ModelCallResult(ai=ai, emitted_text=emitted_text)


def _run_tool_calls(
    *,
    tool_controller: ToolController,
    tool_calls: list[dict[str, Any]],
    messages: list[BaseMessage],
    event_builder: _StreamEventBuilder,
) -> Iterable[str]:
    for tc in tool_calls:
        name = (tc.get("name") or "").strip()
        tc_id = (tc.get("id") or "").strip() or name or "tool_call"
        raw_args = tc.get("args")
        yield event_builder.tool_start(name=name, tc_id=tc_id, args=raw_args)
        try:
            result = tool_controller.invoke_tool(name, raw_args)
            tool_content = _tool_message_content(result)
            event_result = result if isinstance(result, (dict, list)) else tool_content
            yield event_builder.tool_result(name=name, tc_id=tc_id, result=event_result)
            messages.append(ToolMessage(tool_call_id=tc_id, content=tool_content))
        except Exception as e:
            err = str(e)
            yield event_builder.tool_error(name=name, tc_id=tc_id, error=err)
            messages.append(
                ToolMessage(tool_call_id=tc_id, content=_tool_message_content({"error": err}))
            )


def _sse_event_iter_for_chat(
    llm: Any,
    *,
    lc_messages: list[BaseMessage],
    max_tool_rounds: int = _MAX_TOOL_ROUNDS,
) -> Iterable[str]:
    tool_controller = ToolController()
    event_builder = _StreamEventBuilder()
    tools = tool_controller.get_tools()
    llm_with_tools = _bind_tools_if_supported(llm, tools)
    messages = list(lc_messages)

    try:
        for _round in range(max_tool_rounds):
            model_result = yield from _call_model_once(
                llm_with_tools=llm_with_tools,
                llm_raw=llm,
                messages=messages,
                event_builder=event_builder,
            )
            ai = model_result.ai
            emitted_text = model_result.emitted_text
            if ai is None:
                yield event_builder.done()
                return

            tool_calls = list(getattr(ai, "tool_calls", []) or [])
            if not tool_calls:
                text = _stream_chunk_text(ai)
                if text and not emitted_text:
                    yield event_builder.delta(text)
                yield event_builder.done()
                return

            messages.append(ai)
            yield from _run_tool_calls(
                tool_controller=tool_controller,
                tool_calls=tool_calls,
                messages=messages,
                event_builder=event_builder,
            )

        yield event_builder.error(f"工具调用轮次超过上限（max={max_tool_rounds}）")
        return
    except Exception as e:
        yield event_builder.error(f"LLM 调用失败：{e}")
        return


class _AssistantStreamAccumulator:
    """Rebuild assistant ``blocks`` from the same SSE stream the client sees."""

    def __init__(self) -> None:
        self.blocks: list[AssistantBlockPublic] = []

    def append_delta(self, delta: str) -> None:
        if not self.blocks:
            self.blocks.append(AssistantBlockPublic(kind="text", content=delta))
            return
        last = self.blocks[-1]
        if last.kind == "text":
            last.content = (last.content or "") + delta
        else:
            self.blocks.append(AssistantBlockPublic(kind="text", content=delta))

    def apply_tool_start(self, name: str, tc_id: str, args: Any) -> None:
        call = ChatToolCallPublic(
            id=tc_id,
            name=name,
            args=args,
            status="running",
        )
        self.blocks.append(AssistantBlockPublic(kind="tool", call=call))

    def _patch_tool_call(self, tc_id: str, *, ok: bool, result: Any, error: str | None) -> None:
        if not self.blocks:
            return
        for b in self.blocks:
            if b.kind != "tool" or b.call is None or b.call.id != tc_id:
                continue
            if ok:
                b.call.status = "ok"
                b.call.result = result
                b.call.error = None
            else:
                b.call.status = "error"
                b.call.error = error or ""
                b.call.result = None
            break

    def apply_tool_result(self, tc_id: str, result: Any) -> None:
        self._patch_tool_call(tc_id, ok=True, result=result, error=None)

    def apply_tool_error(self, tc_id: str, err: str) -> None:
        self._patch_tool_call(tc_id, ok=False, result=None, error=err)

    def process_event(self, event: str) -> bool:
        """Return True if payload contained a stream ``error`` (do not persist assistant)."""
        if not event.startswith("data: "):
            return False
        raw = event.removeprefix("data: ").strip()
        if not raw:
            return False
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            return False
        if isinstance(payload.get("error"), str):
            return True
        if payload.get("message_ids") is not None:
            return False
        delta = payload.get("delta")
        if isinstance(delta, str) and delta:
            self.append_delta(delta)
        ts = payload.get("tool_start")
        if isinstance(ts, dict):
            self.apply_tool_start(
                str(ts.get("name") or ""),
                str(ts.get("id") or ""),
                ts.get("args"),
            )
        tr = payload.get("tool_result")
        if isinstance(tr, dict):
            self.apply_tool_result(str(tr.get("id") or ""), tr.get("result"))
        te = payload.get("tool_error")
        if isinstance(te, dict):
            self.apply_tool_error(
                str(te.get("id") or ""),
                str(te.get("error") or ""),
            )
        return False


def _persist_chat_if_needed(
    session_id: str,
    messages: list[ChatMessageIn],
    acc: _AssistantStreamAccumulator | None,
    saw_error: bool,
    assistant_message_id: str,
) -> None:
    if saw_error:
        return
    session = get_active_chat(session_id)
    if session is None:
        return

    final_messages = list(messages)
    blocks = acc.blocks if acc else []
    if blocks:
        final_messages.append(
            ChatMessageIn(
                id=assistant_message_id,
                role="assistant",
                blocks=blocks,
            )
        )
    try:
        replace_session_messages(session_id, final_messages)
    except ValueError:
        return


def _persist_user_messages_on_receive(session_id: str, message: ChatMessageIn) -> None:
    rec = get_active_chat(session_id)
    if rec is None:
        return
    message_filled = ensure_chat_message_id(message)
    try:
        if rec.message_count < MAX_SESSION_MESSAGES:
            ChatRegistry.append_message(session_id, message_filled)
            return
        keep = (ChatRegistry.get_messages(session_id) or [])[-(MAX_SESSION_MESSAGES - 1) :]
        replace_session_messages(session_id, [*keep, message_filled])
    except ValueError:
        return


def get_llm_settings() -> LlmSettings:
    return load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )


def put_llm_settings(body: LlmSettings) -> LlmSettings:
    save_workspace_config(_CONFIG_FILE, body)
    return body


def stream(body: ChatRequest) -> Iterator[str]:
    session = get_active_chat(body.session_id)
    if session is None:
        raise ValueError("会话不存在或已归档")

    # Request carries exactly one new user message; model context is built from
    # persisted history + this single incoming turn.
    incoming_user = ensure_chat_message_id(body.message)
    if not incoming_user.id:
        raise ValueError("user 消息 id 生成失败")

    history_messages = ChatRegistry.get_messages(body.session_id) or []
    context_messages = [*history_messages, incoming_user]
    last_user_id = incoming_user.id
    assistant_message_id = str(uuid.uuid4())

    _persist_user_messages_on_receive(body.session_id, incoming_user)
    out: queue.Queue[str | None] = queue.Queue()

    def _producer() -> None:
        acc = _AssistantStreamAccumulator()
        saw_error = False
        try:
            out.put(
                f"data: {json.dumps({'message_ids': {'user': last_user_id, 'assistant': assistant_message_id}}, ensure_ascii=False)}\n\n"
            )
            try:
                llm = _build_llm_from_workspace()
            except ValueError as e:
                err = f"{e}"
                saw_error = True
                out.put(f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n")
                return

            lc_messages = lc_messages_from_chat_messages(context_messages)
            for event in _sse_event_iter_for_chat(llm, lc_messages=lc_messages):
                if acc.process_event(event):
                    saw_error = True
                out.put(event)
        finally:
            try:
                _persist_chat_if_needed(
                    body.session_id,
                    context_messages,
                    acc,
                    saw_error,
                    assistant_message_id,
                )
            finally:
                out.put(None)

    threading.Thread(target=_producer, daemon=True).start()

    def _iter() -> Iterator[str]:
        while True:
            ev = out.get()
            if ev is None:
                return
            yield ev

    return _iter()


def list_chats() -> list[ChatSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is None]
    items.sort(key=lambda i: i.updated_at, reverse=True)
    return [record_to_summary(i) for i in items]


def list_archived_chats() -> list[ChatArchivedSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is not None]
    items.sort(key=lambda i: i.archived_at or "", reverse=True)
    return [record_to_archived_summary(i) for i in items]


def create_chat(body: ChatCreateBody) -> ChatDetailPublic:
    now = utc_now_iso()
    sid = _CHAT_ID_GENERATOR()
    rec_obj = ChatRecord(
        id=sid,
        title=body.title.strip() or "新会话",
        message_file=ChatRegistry._message_filename(sid),
        message_count=0,
        created_at=now,
        updated_at=now,
    )
    ChatRegistry.add_item(rec_obj)
    return record_to_detail(rec_obj)


def get_chat(session_id: str) -> ChatDetailPublic | None:
    rec = get_active_chat(session_id)
    if rec is None:
        return None
    return record_to_detail(rec)


def rename_chat(session_id: str, body: ChatRenameBody) -> ChatDetailPublic | None:
    name = body.title.strip()
    if not name:
        raise ValueError("title 不能为空")

    def _apply(rec: ChatRecord) -> None:
        if rec.archived_at is not None:
            raise ValueError("会话已归档")
        rec.title = name
        rec.updated_at = utc_now_iso()

    rec = ChatRegistry.update_item(session_id, _apply)
    if rec is None:
        return None
    return record_to_detail(rec)


def delete_chat(session_id: str) -> bool:
    rec = ChatRegistry.get_item(session_id)
    if rec is None:
        return False
    if rec.archived_at is not None:
        return True

    def _apply(item: ChatRecord) -> None:
        now = utc_now_iso()
        item.archived_at = now
        item.updated_at = now

    rec = ChatRegistry.update_item(session_id, _apply)
    return rec is not None


def restore_chat(session_id: str) -> ChatDetailPublic | None:
    rec = ChatRegistry.get_item(session_id)
    if rec is None or rec.archived_at is None:
        return None

    def _apply(item: ChatRecord) -> None:
        item.archived_at = None
        item.updated_at = utc_now_iso()

    rec = ChatRegistry.update_item(session_id, _apply)
    if rec is None:
        return None
    return record_to_detail(rec)


def purge_archived_chat(session_id: str) -> bool:
    rec = ChatRegistry.get_item(session_id)
    if rec is None or rec.archived_at is None:
        return False
    rec = ChatRegistry.delete_item(session_id)
    return rec is not None


def get_active_chat(session_id: str) -> ChatRecord | None:
    rec = ChatRegistry.get_item(session_id)
    if rec is None or rec.archived_at is not None:
        return None
    return rec


def replace_session_messages(session_id: str, messages: list[ChatMessageIn]) -> None:
    rec = get_active_chat(session_id)
    if rec is None:
        raise ValueError("会话已归档")
    trimmed = [ensure_chat_message_id(m) for m in list(messages)[-MAX_SESSION_MESSAGES:]]
    ChatRegistry.replace_messages(session_id, trimmed)

    def _apply(item: ChatRecord) -> None:
        item.message_count = len(trimmed)
        item.updated_at = utc_now_iso()

    ChatRegistry.update_item(session_id, _apply)
