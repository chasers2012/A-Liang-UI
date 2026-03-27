"""Chat LLM: local Ollama via ``init_chat_model``."""

from __future__ import annotations

import os
import sys
from collections.abc import Sequence
from typing import Any, cast

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage

from agent.logging_setup import get_agent_logger

_llm_log = get_agent_logger(__name__)

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


def _streaming_piece_text(chunk: Any) -> str:
    content = getattr(chunk, "content", chunk)
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


def message_text(msg: Any) -> str:
    """Plain text from AIMessage-like objects."""
    content = getattr(msg, "content", msg)
    if isinstance(content, str):
        return _strip_reasoning_noise(content)
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if (block.get("type") == "text" and block.get("text")) or "text" in block:
                    parts.append(str(block["text"]))
            elif isinstance(block, str):
                parts.append(block)
        return _strip_reasoning_noise("".join(parts))
    return _strip_reasoning_noise(str(content))


def _llm_log_max_chars() -> int:
    raw = os.environ.get("FACTOR_AGENT_LLM_LOG_MAX_CHARS", "32768").strip()
    if not raw:
        return 32768
    try:
        return int(raw, 10)
    except ValueError:
        return 32768


def _truncate_for_log(text: str, max_len: int) -> str:
    if max_len <= 0 or len(text) <= max_len:
        return text
    return text[:max_len] + f"\n...[truncated, total {len(text)} chars]"


def _message_content_str(m: BaseMessage) -> str:
    content = getattr(m, "content", "")
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


def _messages_preview(messages: Sequence[BaseMessage]) -> str:
    parts: list[str] = []
    for m in messages:
        cls = m.__class__.__name__
        parts.append(f"[{cls}]\n{_message_content_str(m)}")
    return "\n---\n".join(parts)


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


def stream_logged(
    llm: BaseChatModel,
    messages: list[BaseMessage],
    *,
    stage: str,
) -> Any:
    """
    Call ``llm.stream`` or ``invoke``, aggregate to one message, log request/response.

    See trade-backend ``addons.agent.llm.stream_logged`` for env vars.
    """
    from langchain_core.messages import AIMessage

    max_c = _llm_log_max_chars()
    inp = _messages_preview(messages)
    _llm_log.info(
        "LLM request [%s] total_input_chars=%s\n%s",
        stage,
        len(inp),
        _truncate_for_log(inp, max_c),
    )
    show = _stream_output_enabled()
    use_stream = _use_stream_iterator()

    if not use_stream:
        _llm_log.info(
            "LLM invoke [%s]（非流式 API）",
            stage,
        )
        out = llm.invoke(messages)
        out_text = message_text(out)
        if show:
            sys.stdout.write(f"\n[LLM {stage}]\n{out_text}\n")
            sys.stdout.flush()
        _llm_log.info(
            "LLM response [%s] output_chars=%s\n%s",
            stage,
            len(out_text),
            _truncate_for_log(out_text, max_c),
        )
        return AIMessage(content=out_text)

    if show:
        sys.stdout.write(f"\n[LLM {stage}]\n")
        sys.stdout.flush()
    _llm_log.info(
        "LLM stream [%s] 开始（%s）",
        stage,
        "流式输出到 stdout" if show else "仅聚合、不打印 stdout",
    )

    full_chunk: Any = None
    cap = _stream_max_chunks()
    for i, chunk in enumerate(llm.stream(messages)):
        if i >= cap:
            msg = (
                f"LLM stream [{stage}] 超过 FACTOR_AGENT_STREAM_MAX_CHUNKS={cap}，"
                "疑似流异常未结束，已中止。"
            )
            _llm_log.error(msg)
            raise RuntimeError(msg)
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
        _llm_log.warning("LLM stream [%s] 无 chunk", stage)
        return AIMessage(content="")

    out_text = message_text(full_chunk)
    _llm_log.info(
        "LLM response [%s] output_chars=%s\n%s",
        stage,
        len(out_text),
        _truncate_for_log(out_text, max_c),
    )
    return AIMessage(content=out_text)


def invoke_logged(
    llm: BaseChatModel,
    messages: list[BaseMessage],
    *,
    stage: str,
) -> Any:
    """Alias for :func:`stream_logged`."""
    return stream_logged(llm, messages, stage=stage)


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


def build_chat_llm() -> BaseChatModel:
    """
    ``init_chat_model("ollama:<model>", ...)``.

    Env:
      FACTOR_AGENT_MODEL / OLLAMA_MODEL (default qwen3.5:9b)
      OLLAMA_BASE_URL (default http://127.0.0.1:11434)
      FACTOR_AGENT_TEMPERATURE (default 1)
      FACTOR_AGENT_OLLAMA_TIMEOUT (seconds, default 600)
      FACTOR_AGENT_NUM_PREDICT (-1 = no limit)
      FACTOR_AGENT_OLLAMA_REASONING 0/1
    """
    temperature = float(os.environ.get("FACTOR_AGENT_TEMPERATURE", "1"))
    model = os.environ.get("FACTOR_AGENT_MODEL") or os.environ.get("OLLAMA_MODEL", "qwen3.5:9b")
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    timeout = _parse_float("FACTOR_AGENT_OLLAMA_TIMEOUT", 600.0)
    num_predict = _parse_int_env("FACTOR_AGENT_NUM_PREDICT", -1)

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
