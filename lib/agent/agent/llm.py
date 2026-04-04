"""Chat LLM via ``init_chat_model`` (Ollama default; optional OpenAI from workspace config)."""

from __future__ import annotations

from typing import Any

__all__ = ["message_text"]

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


def message_text(msg: Any) -> str:
    """Plain text from AIMessage-like objects."""
    raw = _message_content_blocks_to_str(getattr(msg, "content", msg))
    return _strip_reasoning_noise(raw)
