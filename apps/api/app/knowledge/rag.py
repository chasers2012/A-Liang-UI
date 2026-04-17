from __future__ import annotations

from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from typing import Any

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from workspace import workspace_path

from app.knowledge.schemas import KnowledgeSettings


class LocalEmbeddings(Embeddings):
    """Use LangChain embedding wrappers with a local default model."""

    def __init__(self, settings: KnowledgeSettings) -> None:
        self._settings = settings
        provider = settings.embedding_provider.lower()
        model = settings.embedding_model
        kwargs = dict(settings.embedding_kwargs or {})
        if provider == "huggingface":
            try:
                module = import_module("langchain_huggingface")
                HuggingFaceEmbeddings = module.HuggingFaceEmbeddings
            except (
                ImportError,
                AttributeError,
            ) as exc:  # pragma: no cover - runtime dependency guard
                raise ValueError(
                    "缺少 langchain-huggingface 依赖，请在 apps/api 环境安装后再使用 Knowledge 检索。"
                ) from exc
            self._embedding_fn = HuggingFaceEmbeddings(
                model_name=model,
                encode_kwargs=kwargs,
            )
            return
        raise ValueError(f"不支持的 embedding_provider: {settings.embedding_provider}")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [list(map(float, vector)) for vector in self._embedding_fn.embed_documents(texts)]

    def embed_query(self, text: str) -> list[float]:
        return [float(value) for value in self._embedding_fn.embed_query(text)]


@dataclass(frozen=True)
class RetrievalResult:
    chunk_id: str
    document_id: str
    content: str
    score: float
    metadata: dict[str, Any]


class VectorStoreAdapter:
    def __init__(self, settings: KnowledgeSettings) -> None:
        self._settings = settings
        self._embedding = LocalEmbeddings(settings)
        persist_dir = self._vector_store_dir()
        persist_dir.mkdir(parents=True, exist_ok=True)
        self._store = self._build_store(persist_dir)

    def _build_store(self, persist_dir: Path):
        try:
            from langchain_chroma import Chroma
        except ImportError as exc:  # pragma: no cover - runtime dependency guard
            raise ValueError(
                "缺少 langchain-chroma 依赖，请在 apps/api 环境安装后再使用 Knowledge 检索。"
            ) from exc
        return Chroma(
            collection_name=self._settings.collection_name,
            embedding_function=self._embedding,
            persist_directory=persist_dir.as_posix(),
        )

    def _vector_store_dir(self) -> Path:
        return workspace_path("data/knowledge/chroma")

    def split_text(self, text: str) -> list[str]:
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
        except ImportError as exc:  # pragma: no cover - runtime dependency guard
            raise ValueError(
                "缺少 langchain-text-splitters 依赖，请在 apps/api 环境安装后再使用 Knowledge 检索。"
            ) from exc
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._settings.chunk_size,
            chunk_overlap=self._settings.chunk_overlap,
        )
        return [piece.strip() for piece in splitter.split_text(text) if piece.strip()]

    def upsert_chunks(
        self,
        *,
        document_id: str,
        chunks: list[str],
        base_metadata: dict[str, Any],
    ) -> list[Document]:
        ids = [f"{document_id}:{idx}" for idx, _ in enumerate(chunks)]
        documents = [
            Document(
                page_content=content,
                metadata={
                    **base_metadata,
                    "document_id": document_id,
                    "chunk_index": idx,
                    "chunk_id": ids[idx],
                },
            )
            for idx, content in enumerate(chunks)
        ]
        if ids:
            self._store.delete(ids=ids)
            self._store.add_documents(documents=documents, ids=ids)
        return documents

    def delete_document(self, document_id: str, chunk_count: int) -> None:
        if chunk_count <= 0:
            return
        ids = [f"{document_id}:{idx}" for idx in range(chunk_count)]
        self._store.delete(ids=ids)

    def retrieve(
        self,
        *,
        query: str,
        top_k: int,
        threshold: float,
        document_ids: list[str] | None = None,
    ) -> list[RetrievalResult]:
        pairs = self._store.similarity_search_with_relevance_scores(query=query, k=top_k)
        results: list[RetrievalResult] = []
        allowed = set(document_ids or [])
        for doc, score in pairs:
            metadata = dict(doc.metadata or {})
            if allowed and str(metadata.get("document_id", "")) not in allowed:
                continue
            if float(score) < threshold:
                continue
            results.append(
                RetrievalResult(
                    chunk_id=str(metadata.get("chunk_id", "")),
                    document_id=str(metadata.get("document_id", "")),
                    content=doc.page_content,
                    score=float(score),
                    metadata=metadata,
                )
            )
        return results


def build_chat_context(query: str, retrievals: list[RetrievalResult]) -> str:
    if not retrievals:
        return ""
    lines = [
        "以下是与用户问题相关的知识库片段，请优先基于这些资料作答；若资料不足，请明确说明。",
        f"用户问题：{query}",
        "",
    ]
    for idx, hit in enumerate(retrievals, start=1):
        lines.append(f"[{idx}] doc={hit.document_id} score={hit.score:.3f}")
        lines.append(hit.content)
        lines.append("")
    return "\n".join(lines).strip()
