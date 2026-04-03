"""Workspace LLM settings for the factor agent (Ollama / OpenAI)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

LlmProvider = Literal["ollama", "openai"]
ChatRole = Literal["user", "assistant", "system"]


class ChatMessageIn(BaseModel):
    role: ChatRole
    content: str = Field(..., min_length=1, max_length=32000)


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
