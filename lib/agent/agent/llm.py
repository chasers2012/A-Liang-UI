"""Chat LLM via ``init_chat_model`` (Ollama default; optional OpenAI from config/env)."""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Iterator
from typing import Any, cast

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage

__all__ = [
    "build_chat_llm",
    "invoke_llm",
    "iter_llm_stream_text_deltas",
    "message_text",
    "stream_llm",
]

# Reasoning tags: strip linearly to avoid catastrophic backtracking on unclosed blocks
_THINK_OPEN = "<" + "think" + ">"
_THINK_CLOSE = "<" + "/think" + ">"


def _strip_reasoning_noise(text: str) -> str:
    """Remove some models' reasoning tag blocks so code fences stay clean."""
    if not text:
        return text
    out: list[str] = []
    i = 0
    while i < len(text):
        a = text.find(_THINK_OPEN, i)
        if a == -1:
            out.append(text[i:])
            break
        out.append(text[i:a])
        b = text.find(_THINK_CLOSE, a + len(_THINK_OPEN))
        if b == -1:
            break
        i = b + len(_THINK_CLOSE)
    return "".join(out).strip()


def _message_content_blocks_to_str(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if (block.get("type") == "text" and block.get("text")) or "text" in block:
                    parts.append(str(block["text"]))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content)


def _streaming_piece_text(chunk: Any) -> str:
    return _message_content_blocks_to_str(getattr(chunk, "content", chunk))


def message_text(msg: Any) -> str:
    """Plain text from AIMessage-like objects."""
    raw = _message_content_blocks_to_str(getattr(msg, "content", msg))
    return _strip_reasoning_noise(raw)


def _stream_output_enabled() -> bool:
    raw = os.environ.get("FACTOR_AGENT_STREAM_OUTPUT", "").strip().lower()
    if raw in {"0", "false", "no", "off"}:
        return False
    if raw in {"1", "true", "yes", "on"}:
        return True
    return sys.stdout.isatty()


def _use_stream_iterator() -> bool:
    raw = os.environ.get("FACTOR_AGENT_STREAM_API", "").strip().lower()
    if raw in {"invoke", "0", "false", "no", "off"}:
        return False
    if raw in {"stream", "1", "true", "yes", "on"}:
        return True
    return _stream_output_enabled()


def _stream_max_chunks() -> int:
    raw = os.environ.get("FACTOR_AGENT_STREAM_MAX_CHUNKS", "200000").strip()
    if not raw:
        return 200000
    try:
        n = int(raw, 10)
        return max(1000, n)
    except ValueError:
        return 200000


def stream_llm(
    llm: BaseChatModel,
    messages: list[BaseMessage],
    *,
    stage: str,
) -> Any:
    """
    Call ``llm.stream`` or ``invoke`` and aggregate to one AIMessage.

    Env: ``FACTOR_AGENT_STREAM_OUTPUT``, ``FACTOR_AGENT_STREAM_API``, ``FACTOR_AGENT_STREAM_MAX_CHUNKS``.
    """
    show = _stream_output_enabled()
    use_stream = _use_stream_iterator()

    if not use_stream:
        out = llm.invoke(messages)
        out_text = message_text(out)
        if show:
            sys.stdout.write(f"\n[LLM {stage}]\n{out_text}\n")
            sys.stdout.flush()
        return AIMessage(content=out_text)

    if show:
        sys.stdout.write(f"\n[LLM {stage}]\n")
        sys.stdout.flush()

    full_chunk: Any = None
    cap = _stream_max_chunks()
    for i, chunk in enumerate(llm.stream(messages)):
        if i >= cap:
            raise RuntimeError(
                f"LLM stream [{stage}] 超过 FACTOR_AGENT_STREAM_MAX_CHUNKS={cap}，"
                "疑似流异常未结束，已中止。"
            )
        if show:
            piece = _streaming_piece_text(chunk)
            if piece:
                sys.stdout.write(piece)
                sys.stdout.flush()
        full_chunk = chunk if full_chunk is None else full_chunk + chunk

    if show:
        sys.stdout.write("\n")
        sys.stdout.flush()

    if full_chunk is None:
        return AIMessage(content="")

    out_text = message_text(full_chunk)
    return AIMessage(content=out_text)


def iter_llm_stream_text_deltas(
    llm: BaseChatModel,
    messages: list[BaseMessage],
    *,
    stage: str,
    force_stream: bool = False,
) -> Iterator[str]:
    """
    Yield incremental assistant text from ``llm.stream`` (or one chunk from ``invoke``).

    ``force_stream=True`` (used by HTTP SSE) always calls ``llm.stream`` so chunks reach
    the client even when stdout is not a TTY (e.g. uvicorn). Otherwise mirrors
    :func:`stream_llm` env for ``invoke`` vs ``stream``.
    """
    show = _stream_output_enabled()
    use_stream = force_stream or _use_stream_iterator()

    if not use_stream:
        out = llm.invoke(messages)
        out_text = message_text(out)
        if show:
            sys.stdout.write(f"\n[LLM {stage}]\n{out_text}\n")
            sys.stdout.flush()
        if out_text:
            yield out_text
        return

    if show:
        sys.stdout.write(f"\n[LLM {stage}]\n")
        sys.stdout.flush()

    cap = _stream_max_chunks()
    for i, chunk in enumerate(llm.stream(messages)):
        if i >= cap:
            raise RuntimeError(
                f"LLM stream [{stage}] 超过 FACTOR_AGENT_STREAM_MAX_CHUNKS={cap}，"
                "疑似流异常未结束，已中止。"
            )
        piece = _streaming_piece_text(chunk)
        if show and piece:
            sys.stdout.write(piece)
            sys.stdout.flush()
        if piece:
            yield piece

    if show:
        sys.stdout.write("\n")
        sys.stdout.flush()


def invoke_llm(
    llm: BaseChatModel,
    messages: list[BaseMessage],
    *,
    stage: str,
) -> Any:
    """Alias for :func:`stream_llm`."""
    return stream_llm(llm, messages, stage=stage)


def _parse_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _parse_int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw, 10)
    except ValueError:
        return default


def _read_agent_llm_workspace_file() -> dict[str, Any]:
    """``config/agent_llm.json`` from workspace (optional; web UI writes this)."""
    from workspace import workspace_path

    path = workspace_path("config", "agent_llm.json")
    if not path.is_file():
        return {}
    try:
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _cfg_str(cfg: dict[str, Any], key: str) -> str | None:
    v = cfg.get(key)
    if isinstance(v, str) and v.strip():
        return v.strip()
    return None


def build_chat_llm() -> BaseChatModel:
    """
    Chat model from ``init_chat_model`` (Ollama or OpenAI).

    Resolution order: environment variables, then ``config/agent_llm.json``
    (saved from the Agent page), then defaults. Default provider is Ollama with
    model ``qwen3.5:9b``.

    Env (override file):
      FACTOR_AGENT_LLM_PROVIDER   ollama | openai
      FACTOR_AGENT_MODEL / OLLAMA_MODEL
      OLLAMA_BASE_URL
      OPENAI_API_KEY
      OPENAI_BASE_URL
      FACTOR_AGENT_TEMPERATURE (default 1)
      FACTOR_AGENT_OLLAMA_TIMEOUT (seconds, default 600)
      FACTOR_AGENT_NUM_PREDICT (-1 = no limit)
      FACTOR_AGENT_OLLAMA_REASONING 0/1
    """
    cfg = _read_agent_llm_workspace_file()
    temperature = float(os.environ.get("FACTOR_AGENT_TEMPERATURE", "1"))

    prov_raw = (
        os.environ.get("FACTOR_AGENT_LLM_PROVIDER", "").strip().lower()
        or _cfg_str(cfg, "provider")
        or "ollama"
    )
    provider = prov_raw if prov_raw in {"ollama", "openai"} else "ollama"

    model = (
        os.environ.get("FACTOR_AGENT_MODEL")
        or os.environ.get("OLLAMA_MODEL")
        or _cfg_str(cfg, "model")
        or "qwen3.5:9b"
    )

    if provider == "openai":
        api_key = (os.environ.get("OPENAI_API_KEY") or "").strip() or None
        if api_key is None:
            api_key = _cfg_str(cfg, "api_key")
        if not api_key:
            raise ValueError(
                "OpenAI 提供方需要 API 密钥：设置环境变量 OPENAI_API_KEY，"
                "或在 Web Agent 页面保存 api_key（写入 config/agent_llm.json）。"
            )
        openai_kwargs: dict[str, Any] = {
            "temperature": temperature,
            "api_key": api_key,
        }
        ob = os.environ.get("OPENAI_BASE_URL", "").strip()
        if ob:
            openai_kwargs["base_url"] = ob.rstrip("/")
        else:
            fu = _cfg_str(cfg, "openai_base_url")
            if fu:
                openai_kwargs["base_url"] = fu.rstrip("/")
        llm = init_chat_model(f"openai:{model}", **openai_kwargs)
        return cast(BaseChatModel, llm)

    timeout = _parse_float("FACTOR_AGENT_OLLAMA_TIMEOUT", 600.0)
    num_predict = _parse_int_env("FACTOR_AGENT_NUM_PREDICT", -1)

    ob_env = os.environ.get("OLLAMA_BASE_URL", "").strip()
    base_url = ob_env or (_cfg_str(cfg, "ollama_base_url") or "http://127.0.0.1:11434")

    reasoning_raw = os.environ.get("FACTOR_AGENT_OLLAMA_REASONING", "").strip().lower()
    reasoning: bool | None = None
    if reasoning_raw in {"0", "false", "no", "off"}:
        reasoning = False
    elif reasoning_raw in {"1", "true", "yes", "on"}:
        reasoning = True

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
