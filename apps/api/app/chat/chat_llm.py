"""Build LangChain chat models for API routes from workspace ``config/agent_llm.json``."""

from __future__ import annotations

from typing import Any, cast

from app.chat.llm_schemas import LlmSettings
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel


def stream_chunk_text(chunk: Any) -> str:
    """Incremental text from a single ``llm.stream`` chunk (AIMessageChunk-like)."""
    c = getattr(chunk, "content", chunk)
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts: list[str] = []
        for block in c:
            if (isinstance(block, dict) and "text" in block) or (
                isinstance(block, dict)
                and block.get(
                    "type",
                )
                == "text"
                and block.get("text")
            ):
                parts.append(str(block["text"]))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(c) if c is not None else ""


def build_chat_model_from_workspace_settings(
    settings: LlmSettings,
) -> BaseChatModel:
    """``init_chat_model`` for Ollama or OpenAI from validated :class:`AgentLlmSettings`."""
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
        llm = init_chat_model(f"openai:{model}", **openai_kwargs)
        return cast(BaseChatModel, llm)

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

    llm = init_chat_model(f"ollama:{model}", **kwargs)
    return cast(BaseChatModel, llm)
