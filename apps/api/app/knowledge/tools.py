from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.knowledge import controller
from app.knowledge.schemas import KnowledgeSearchRequest
from app.tool.controller import ToolController


@tool(
    "knowledge_search",
    description="在知识库中检索与用户问题最相关的文档片段，并返回命中的内容、分数和元数据。",
)
def knowledge_search_tool(
    query: str,
    top_k: int | None = None,
    threshold: float | None = None,
    document_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    body = KnowledgeSearchRequest(
        query=query,
        top_k=top_k,
        threshold=threshold,
        document_ids=document_ids,
    )
    response = controller.search_knowledge(body)
    return [hit.model_dump(mode="json") for hit in response.hits]


def register_knowledge_tools() -> None:
    ToolController().register_tool(knowledge_search_tool)
