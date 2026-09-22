"""Workspace LLM settings for the factor agent (Ollama / OpenAI)."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

LlmProvider = Literal["ollama", "openai"]
ChatRole = Literal["user", "assistant", "system"]
ToolCallStatus = Literal["running", "ok", "error"]
ToolCallAuthorizationStatus = Literal["none", "pending", "approved", "rejected"]


class ChatToolCallPublic(BaseModel):
    """Persisted tool invocation (aligned with SSE tool_* payloads)."""

    id: str
    name: str
    args: Any | None = None
    status: ToolCallStatus = "ok"
    authorization_status: ToolCallAuthorizationStatus = "none"
    result: Any | None = None
    error: str | None = None


class AssistantBlockPublic(BaseModel):
    kind: Literal["text", "reasoning", "tool"]
    #: 与 SSE 一致：LangGraph 子图命名空间路径，区分并行分支。
    run_segment_id: str | None = None
    content: str | None = None
    call: ChatToolCallPublic | None = None

    @model_validator(mode="after")
    def check_shape(self) -> AssistantBlockPublic:
        if self.kind in ("text", "reasoning"):
            if self.content is None:
                self.content = ""
            self.call = None
        else:
            if self.call is None:
                raise ValueError("tool 块需要 call")
            self.content = None
        return self


class ChatMessageIn(BaseModel):
    id: str | None = Field(
        default=None,
        description="Stable message id (UUID); assigned by server when omitted.",
    )
    role: ChatRole
    blocks: list[AssistantBlockPublic] = Field(default_factory=list)

    @field_validator("id", mode="before")
    @classmethod
    def empty_message_id_to_none(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def normalize_and_validate_blocks(self) -> ChatMessageIn:
        text = "".join((b.content or "") for b in self.blocks if b.kind == "text").strip()
        if self.role in ("user", "system") and not text:
            raise ValueError("user/system 消息需在 blocks 中提供非空文本")
        if self.role == "assistant" and not self.blocks:
            raise ValueError("assistant 消息 blocks 不能为空")
        return self


def ensure_chat_message_id(message: ChatMessageIn) -> ChatMessageIn:
    """Fill missing ``id`` on one message with a new UUID."""
    return message.model_copy(update={"id": (message.id or "").strip() or str(uuid.uuid4())})


def message_text_for_model(m: ChatMessageIn) -> str:
    """Plain text for LangChain from text blocks."""
    return "".join((b.content or "") for b in m.blocks if b.kind == "text")


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(..., min_length=1, description="Target chat session id.")
    message: ChatMessageIn = Field(..., description="The single incoming user message.")
    replace_from_message_id: str | None = Field(
        default=None,
        description="When provided, replace this message and all following context with the incoming message.",
    )

    @field_validator("session_id", mode="before")
    @classmethod
    def empty_session_id_to_none(cls, v: object) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("session_id 不能为空")
        return s

    @field_validator("replace_from_message_id", mode="before")
    @classmethod
    def normalize_replace_from_message_id(cls, value: object) -> str | None:
        if value is None:
            return None
        message_id = str(value).strip()
        return message_id or None

    @model_validator(mode="after")
    def validate_stream_message(self) -> ChatRequest:
        if self.message.role != "user":
            raise ValueError("message.role 必须为 user")
        return self


class ChatAuthorizationDecision(BaseModel):
    """Decision payload for DeepAgents HITL resume."""

    type: Literal["approve", "reject"] = "approve"
    tool_call_id: str = Field(..., min_length=1)


class ChatAuthorizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(..., min_length=1)
    assistant_message_id: str = Field(..., min_length=1)
    decisions: list[ChatAuthorizationDecision] = Field(..., min_length=1)


class ChatStopRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(..., min_length=1)
    assistant_message_id: str | None = None

    @field_validator("session_id", mode="before")
    @classmethod
    def normalize_session_id(cls, value: object) -> str:
        session_id = str(value).strip()
        if not session_id:
            raise ValueError("session_id 不能为空")
        return session_id

    @field_validator("assistant_message_id", mode="before")
    @classmethod
    def normalize_assistant_message_id(cls, value: object) -> str | None:
        if value is None:
            return None
        assistant_message_id = str(value).strip()
        return assistant_message_id or None


class ChatRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    message_file: str = Field(
        ...,
        description="Workspace-relative JSON file that stores this session's messages.",
    )
    message_count: int = Field(default=0, ge=0)
    created_at: str
    updated_at: str
    archived_at: str | None = None


class ChatsFile(BaseModel):
    version: int = 1
    items: list[ChatRecord] = Field(default_factory=list)


class ChatSummaryPublic(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ChatArchivedSummaryPublic(ChatSummaryPublic):
    archived_at: str


class ChatDetailPublic(BaseModel):
    id: str
    title: str
    messages: list[ChatMessageIn]
    created_at: str
    updated_at: str


class ChatCreateBody(BaseModel):
    title: str = Field(default="新会话", min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        s = v.strip()
        return s or "新会话"


class ChatRenameBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def strip_rename_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("title 不能为空")
        return s


ChatBatchUpdateAction = Literal["archive", "restore"]


class ChatBatchUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: ChatBatchUpdateAction
    session_ids: list[str] = Field(default_factory=list)

    @field_validator("session_ids")
    @classmethod
    def normalize_session_ids(cls, values: list[str]) -> list[str]:
        ids = [str(v).strip() for v in values if str(v).strip()]
        if not ids:
            raise ValueError("session_ids 不能为空")
        # Keep stable order while removing duplicates.
        return list(dict.fromkeys(ids))


class ChatBatchUpdateResult(BaseModel):
    action: ChatBatchUpdateAction
    success_ids: list[str] = Field(default_factory=list)
    failed_ids: list[str] = Field(default_factory=list)


class ChatBatchDeleteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_ids: list[str] = Field(default_factory=list)

    @field_validator("session_ids")
    @classmethod
    def normalize_session_ids(cls, values: list[str]) -> list[str]:
        ids = [str(v).strip() for v in values if str(v).strip()]
        if not ids:
            raise ValueError("session_ids 不能为空")
        return list(dict.fromkeys(ids))


class ChatBatchDeleteResult(BaseModel):
    success_ids: list[str] = Field(default_factory=list)
    failed_ids: list[str] = Field(default_factory=list)
