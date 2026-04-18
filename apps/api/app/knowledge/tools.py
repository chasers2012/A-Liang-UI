from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.knowledge import controller
from app.tool.controller import ToolController
from apps.api.app.knowledge.schemas import KnowledgeSearchHit


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
    "knowledge_search",
    description="在知识库中检索与用户问题最相关的文档片段，并返回命中的文档名称和内容。",
)
def knowledge_search_tool(query: str) -> list[dict[str, Any]]:
    hits = controller.search_knowledge(query)
    return build_chat_context(hits)


def register_knowledge_tools() -> None:
    ToolController().register_tool(knowledge_search_tool)
