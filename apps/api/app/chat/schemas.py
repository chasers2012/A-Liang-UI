"""Workspace LLM settings for the factor agent (Ollama / OpenAI)."""

from __future__ import annotations

import uuid
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
    kind: Literal["text", "reasoning", "tool"]
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

    @field_validator("session_id", mode="before")
    @classmethod
    def empty_session_id_to_none(cls, v: object) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("session_id 不能为空")
        return s

    @model_validator(mode="after")
    def validate_stream_message(self) -> ChatRequest:
        if self.message.role != "user":
            raise ValueError("message.role 必须为 user")
        return self


class ChatAuthorizationDecision(BaseModel):
    """Decision payload for DeepAgents HITL resume."""

    type: Literal["approve", "reject"] = "approve"


class ChatAuthorizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(..., min_length=1)
    assistant_message_id: str = Field(..., min_length=1)
    decision: ChatAuthorizationDecision


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

    @classmethod
    def rjsf_schema_and_ui_schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        defaults = cls().model_dump(mode="json")
        schema: dict[str, Any] = {
            "type": "object",
            "title": "模型与密钥",
            "properties": {
                "provider": {
                    "title": "提供方",
                    "type": "string",
                    "enum": ["ollama", "openai"],
                    "enumNames": ["Ollama（本地）", "OpenAI"],
                    "default": defaults["provider"],
                },
                "model": {
                    "title": "模型名",
                    "type": "string",
                    "default": defaults["model"],
                },
                "temperature": {
                    "title": "Temperature",
                    "type": "number",
                    "default": defaults["temperature"],
                },
            },
            "required": ["provider", "model", "temperature"],
            "dependencies": {
                "provider": {
                    "oneOf": [
                        {
                            "properties": {
                                "provider": {"enum": ["ollama"]},
                                "ollama_base_url": {
                                    "title": "Ollama 地址",
                                    "type": "string",
                                    "default": defaults["ollama_base_url"],
                                },
                                "ollama_timeout": {
                                    "title": "Ollama 超时时间（秒）",
                                    "type": "number",
                                    "default": defaults["ollama_timeout"],
                                },
                                "ollama_num_predict": {
                                    "title": "Ollama num_predict",
                                    "type": "number",
                                    "default": defaults["ollama_num_predict"],
                                },
                                "ollama_reasoning": {
                                    "title": "Ollama reasoning",
                                    "type": "boolean",
                                    "default": defaults["ollama_reasoning"],
                                },
                            },
                            "required": [
                                "ollama_base_url",
                                "ollama_timeout",
                                "ollama_num_predict",
                            ],
                        },
                        {
                            "properties": {
                                "provider": {"enum": ["openai"]},
                                "openai_base_url": {
                                    "title": "OpenAI API 基址（可选）",
                                    "type": "string",
                                    "default": defaults["openai_base_url"],
                                },
                                "api_key": {
                                    "title": "API Key",
                                    "type": "string",
                                    "default": defaults["api_key"],
                                },
                            },
                        },
                    ]
                }
            },
        }
        ui_schema: dict[str, Any] = {
            "ui:submitButtonOptions": {"norender": True},
            "model": {"ui:placeholder": "qwen3.5:9b"},
            "ollama_base_url": {"ui:placeholder": "http://127.0.0.1:11434"},
            "openai_base_url": {"ui:placeholder": "默认 api.openai.com"},
            "api_key": {"ui:widget": "password", "ui:placeholder": "sk-..."},
            "ollama_reasoning": {"ui:help": "未设置时使用 Ollama 默认行为。"},
        }
        return schema, ui_schema
