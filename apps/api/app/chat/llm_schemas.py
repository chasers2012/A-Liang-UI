"""Workspace LLM settings for the factor agent (Ollama / OpenAI)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

LlmProvider = Literal["ollama", "openai"]
ChatRole = Literal["user", "assistant", "system"]
ToolCallStatus = Literal["running", "ok", "error"]


class ChatToolCallPublic(BaseModel):
    """Persisted tool invocation (aligned with SSE tool_* payloads)."""

    id: str
    name: str
    args: Any | None = None
    status: ToolCallStatus = "ok"
    result: Any | None = None
    error: str | None = None


class AssistantBlockPublic(BaseModel):
    kind: Literal["text", "tool"]
    content: str | None = None
    call: ChatToolCallPublic | None = None

    @model_validator(mode="after")
    def check_shape(self) -> AssistantBlockPublic:
        if self.kind == "text":
            if self.content is None:
                self.content = ""
            self.call = None
        else:
            if self.call is None:
                raise ValueError("tool 块需要 call")
            self.content = None
        return self


class ChatMessageIn(BaseModel):
    role: ChatRole
    # 兼容旧数据：content 已并入 blocks，仍接受并迁移。
    content: str | None = Field(default=None, max_length=32000)
    blocks: list[AssistantBlockPublic] = Field(default_factory=list)

    @model_validator(mode="after")
    def normalize_and_validate_blocks(self) -> ChatMessageIn:
        legacy_text = self.content or ""
        has_legacy_text = bool(legacy_text.strip())

        if has_legacy_text:
            if self.blocks and self.blocks[0].kind == "text":
                self.blocks[0].content = legacy_text + (self.blocks[0].content or "")
            else:
                self.blocks = [AssistantBlockPublic(kind="text", content=legacy_text), *self.blocks]

        # content 不再持久化，仅用于兼容输入。
        self.content = None

        text = "".join((b.content or "") for b in self.blocks if b.kind == "text").strip()
        if self.role in ("user", "system") and not text:
            raise ValueError("user/system 消息需在 blocks 中提供非空文本")
        if self.role == "assistant" and not self.blocks:
            raise ValueError("assistant 消息 blocks 不能为空")
        return self


def message_text_for_model(m: ChatMessageIn) -> str:
    """Plain text for LangChain from text blocks."""
    return "".join((b.content or "") for b in m.blocks if b.kind == "text")


class ChatRequest(BaseModel):
    messages: list[ChatMessageIn] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Conversation turns in order (system / user / assistant).",
    )
    session_id: str | None = Field(
        default=None,
        description="Optional chat session id for persistence.",
    )

    @field_validator("session_id", mode="before")
    @classmethod
    def empty_session_id_to_none(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class ChatSessionRecord(BaseModel):
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


class ChatSessionsFile(BaseModel):
    version: int = 1
    items: list[ChatSessionRecord] = Field(default_factory=list)


class ChatSessionSummaryPublic(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ChatSessionArchivedSummaryPublic(ChatSessionSummaryPublic):
    archived_at: str


class ChatSessionDetailPublic(BaseModel):
    id: str
    title: str
    messages: list[ChatMessageIn]
    created_at: str
    updated_at: str


class ChatSessionCreateBody(BaseModel):
    title: str = Field(default="新会话", min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        s = v.strip()
        return s or "新会话"


class ChatSessionRenameBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def strip_rename_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("title 不能为空")
        return s


class LlmSettings(BaseModel):
    provider: LlmProvider = "ollama"
    model: str = Field(default="qwen3.5:9b", min_length=1)
    ollama_base_url: str = Field(default="http://127.0.0.1:11434", min_length=1)
    openai_base_url: str | None = None
    api_key: str | None = Field(
        default=None,
        description="Used when provider is openai; Ollama ignores this.",
    )
    temperature: float = Field(default=1.0, ge=0.0)
    ollama_timeout: float = Field(
        default=600.0, ge=1.0, description="Ollama client timeout (seconds)."
    )
    ollama_num_predict: int = Field(
        default=-1,
        description="Ollama num_predict (-1 = no limit).",
    )
    ollama_reasoning: bool | None = Field(
        default=None,
        description="Ollama reasoning mode; None = let provider default.",
    )

    @field_validator("openai_base_url", mode="before")
    @classmethod
    def empty_openai_url_to_none(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v)

    @field_validator("api_key", mode="before")
    @classmethod
    def empty_api_key_to_none(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v)

    @field_validator("ollama_reasoning", mode="before")
    @classmethod
    def coerce_ollama_reasoning(cls, v: object) -> bool | None:
        if v is None:
            return None
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            s = v.strip().lower()
            if not s:
                return None
            if s in {"0", "false", "no", "off"}:
                return False
            if s in {"1", "true", "yes", "on"}:
                return True
        return None

    @field_validator("ollama_num_predict", mode="before")
    @classmethod
    def coerce_ollama_num_predict(cls, v: object) -> int:
        if v is None:
            return -1
        if isinstance(v, bool):
            raise ValueError("ollama_num_predict must be an integer")
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            return int(v)
        if isinstance(v, str) and v.strip():
            return int(v.strip(), 10)
        return -1
