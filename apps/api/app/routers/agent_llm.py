"""Read/write ``config/agent_llm.json`` for the factor agent CLI and web UI."""

from __future__ import annotations

import json
import queue
import threading
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.chat.agent_chat import lc_messages_from_chat_request, sse_event_iter_for_chat
from app.chat.chat_llm import build_chat_model_from_workspace_settings
from app.chat.llm_schemas import (
    AssistantBlockPublic,
    ChatMessageIn,
    ChatRequest,
    ChatSessionArchivedSummaryPublic,
    ChatSessionCreateBody,
    ChatSessionDetailPublic,
    ChatSessionRenameBody,
    ChatSessionSummaryPublic,
    ChatToolCallPublic,
    LlmSettings,
)
from app.chat.session_registry import (
    ChatSessionRegistry,
    record_to_archived_summary,
    record_to_detail,
    record_to_summary,
)
from app.workspace_config import load_workspace_config, save_workspace_config

router = APIRouter(prefix="/agent", tags=["agent"])

_CONFIG_FILE = "agent/llm.json"


def _defaults() -> LlmSettings:
    return LlmSettings()


def _build_llm_from_workspace():
    settings = load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )
    return build_chat_model_from_workspace_settings(settings)


class _AssistantStreamAccumulator:
    """Rebuild assistant ``blocks`` + full text from the same SSE stream the client sees."""

    def __init__(self) -> None:
        self._text_parts: list[str] = []
        self.blocks: list[AssistantBlockPublic] | None = None

    @property
    def full_text(self) -> str:
        return "".join(self._text_parts)

    def append_delta(self, delta: str) -> None:
        self._text_parts.append(delta)
        if self.blocks is None:
            return
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
        if self.blocks is None:
            self.blocks = [
                AssistantBlockPublic(kind="text", content=self.full_text),
                AssistantBlockPublic(kind="tool", call=call),
            ]
        else:
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


def _persist_chat_session_if_needed(
    body: ChatRequest,
    acc: _AssistantStreamAccumulator | None,
    saw_error: bool,
) -> None:
    if saw_error or not body.session_id:
        return
    session = ChatSessionRegistry.get_active_item(body.session_id)
    if session is None:
        return

    final_messages = list(body.messages)
    assistant_text = (acc.full_text if acc else "").strip()
    blocks = acc.blocks if acc and acc.blocks else None
    if assistant_text or blocks:
        final_messages.append(
            ChatMessageIn(
                role="assistant",
                content=assistant_text if assistant_text else "",
                blocks=blocks,
            )
        )
    try:
        ChatSessionRegistry.replace_messages(body.session_id, final_messages)
    except ValueError:
        # Session may be archived while a generation is in progress.
        return


def _persist_user_messages_on_receive(body: ChatRequest) -> None:
    """Persist current client messages immediately after request is accepted."""
    if not body.session_id:
        return
    if ChatSessionRegistry.get_active_item(body.session_id) is None:
        return
    try:
        ChatSessionRegistry.replace_messages(body.session_id, list(body.messages))
    except ValueError:
        # Session may become archived between checks; ignore and continue streaming.
        return


@router.get("/llm-settings", response_model=LlmSettings)
def get_llm_settings() -> LlmSettings:
    return load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )


@router.put("/llm-settings", response_model=LlmSettings)
def put_llm_settings(body: LlmSettings) -> LlmSettings:
    save_workspace_config(_CONFIG_FILE, body)
    return body


@router.post("/chat/stream")
def chat_stream(body: ChatRequest) -> StreamingResponse:
    """SSE (``text/event-stream``): incremental assistant text as JSON lines ``data: {...}``."""
    _persist_user_messages_on_receive(body)

    def event_iter():
        out: queue.Queue[str | None] = queue.Queue()

        def _producer() -> None:
            acc = _AssistantStreamAccumulator()
            saw_error = False
            try:
                try:
                    llm = _build_llm_from_workspace()
                except ValueError as e:
                    err = f"{e}"
                    saw_error = True
                    out.put(f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n")
                    return

                lc_messages = lc_messages_from_chat_request(body)
                for event in sse_event_iter_for_chat(llm, lc_messages=lc_messages):
                    if acc.process_event(event):
                        saw_error = True
                    out.put(event)
            finally:
                try:
                    _persist_chat_session_if_needed(body, acc, saw_error)
                finally:
                    out.put(None)

        threading.Thread(target=_producer, daemon=True).start()

        while True:
            ev = out.get()
            if ev is None:
                return
            yield ev

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/sessions", response_model=list[ChatSessionSummaryPublic])
def list_chat_sessions() -> list[ChatSessionSummaryPublic]:
    items = ChatSessionRegistry.list_active_items()
    items.sort(key=lambda i: i.updated_at, reverse=True)
    return [record_to_summary(i) for i in items]


@router.get(
    "/chat/sessions/archived",
    response_model=list[ChatSessionArchivedSummaryPublic],
)
def list_archived_chat_sessions() -> list[ChatSessionArchivedSummaryPublic]:
    items = ChatSessionRegistry.list_archived_items()
    items.sort(key=lambda i: i.archived_at or "", reverse=True)
    return [record_to_archived_summary(i) for i in items]


@router.post(
    "/chat/sessions",
    response_model=ChatSessionDetailPublic,
    response_model_exclude_none=True,
)
def create_chat_session(body: ChatSessionCreateBody) -> ChatSessionDetailPublic:
    rec = ChatSessionRegistry.create_session(body.title)
    return record_to_detail(rec)


@router.get(
    "/chat/sessions/{session_id}",
    response_model=ChatSessionDetailPublic,
    response_model_exclude_none=True,
)
def get_chat_session(session_id: str) -> ChatSessionDetailPublic:
    rec = ChatSessionRegistry.get_active_item(session_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return record_to_detail(rec)


@router.patch(
    "/chat/sessions/{session_id}",
    response_model=ChatSessionDetailPublic,
    response_model_exclude_none=True,
)
def rename_chat_session(session_id: str, body: ChatSessionRenameBody) -> ChatSessionDetailPublic:
    if ChatSessionRegistry.get_active_item(session_id) is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    try:
        rec = ChatSessionRegistry.rename_session(session_id, body.title)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return record_to_detail(rec)


@router.delete("/chat/sessions/{session_id}", status_code=204)
def delete_chat_session(session_id: str) -> None:
    rec = ChatSessionRegistry.archive_session(session_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")


@router.post(
    "/chat/sessions/{session_id}/restore",
    response_model=ChatSessionDetailPublic,
    response_model_exclude_none=True,
)
def restore_chat_session(session_id: str) -> ChatSessionDetailPublic:
    rec = ChatSessionRegistry.restore_session(session_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在或未被归档")
    return record_to_detail(rec)
