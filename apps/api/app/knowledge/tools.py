from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.tool.models import ToolAuthorization
from app.tool.registry import ChatToolRegistry

from .controller import search_knowledge
from .schemas import KnowledgeSearchHit


def build_chat_context(query: str, hits: list[KnowledgeSearchHit]) -> str:
    if not hits:
        return ""
    lines = [
        "以下是与用户问题相关的知识库片段，请优先基于这些资料作答；若资料不足，请明确说明。",
        f"用户问题：{query}",
        "",
    ]
    for idx, hit in enumerate(hits, start=1):
        lines.append(f"[{idx}] doc={hit.document_name}: ")
        lines.append(hit.content)
        lines.append("")
    return "\n".join(lines).strip()


@tool(
    "知识库检索",
    description=(
        "检索与问题相关的知识库内容。\n"
        "入参 query 为用户问题；优先基于命中内容回答，若证据不足需明确说明不确定性。"
    ),
)
def knowledge_search_tool(query: str) -> list[dict[str, Any]]:
    hits = search_knowledge(query)
    return build_chat_context(query, hits)


def register_knowledge_tools() -> None:
    ChatToolRegistry.instance().register_tool(
        knowledge_search_tool,
        name="knowledge.search",
        category="知识库",
        authorization=ToolAuthorization.allowed,
    )
