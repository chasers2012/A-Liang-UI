from __future__ import annotations

from dataclasses import dataclass
from importlib import import_module
from typing import Any

from langchain_chroma import Chroma
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
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
    _instance: VectorStoreAdapter | None = None
    _initialized = False

    def __new__(cls, settings: KnowledgeSettings) -> VectorStoreAdapter:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, settings: KnowledgeSettings) -> None:
        if self.__class__._initialized:
            return
        self._settings = settings
        self._embedding = LocalEmbeddings(settings)
        self._reranker: Any = None
        persist_dir = workspace_path("data/knowledge/chroma")
        persist_dir.mkdir(parents=True, exist_ok=True)
        self._store = Chroma(
            collection_name=self._settings.collection_name,
            embedding_function=self._embedding,
            persist_directory=persist_dir.as_posix(),
        )
        self._create_splitter()
        self._create_reranker()
        self.__class__._initialized = True

    def _create_splitter(self):
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._settings.chunk_size,
            chunk_overlap=self._settings.chunk_overlap,
        )

    def _create_reranker(self):
        model = HuggingFaceCrossEncoder(model_name=self._settings.rerank_model)
        self._reranker = CrossEncoderReranker(model=model, top_n=self._settings.rerank_top_n)

    def split_text(self, text: str) -> list[str]:
        return [piece.strip() for piece in self._splitter.split_text(text) if piece.strip()]

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

    def _score_pairs(self, query: str, docs: list[Document]) -> list[float]:
        try:
            compressed = self._reranker.compress_documents(docs, query)
        except Exception:
            return []
        scores: list[float] = []
        for idx, doc in enumerate(compressed):
            metadata = dict(doc.metadata or {})
            score = metadata.get("relevance_score", metadata.get("score", len(compressed) - idx))
            scores.append(float(score))
        return scores

    def retrieve(
        self,
        *,
        query: str,
        top_k: int,
        threshold: float,
        document_ids: list[str] | None = None,
    ) -> list[RetrievalResult]:
        pairs = self._store.similarity_search_with_relevance_scores(query=query, k=top_k)
        allowed = set(document_ids or [])
        candidates: list[tuple[Document, float]] = []
        for doc, score in pairs:
            metadata = dict(doc.metadata or {})
            if allowed and str(metadata.get("document_id", "")) not in allowed:
                continue
            if float(score) < threshold:
                continue
            candidates.append((doc, float(score)))
        if not candidates:
            return []
        docs = [doc for doc, _ in candidates]
        rerank_scores = self._score_pairs(query, docs)
        if rerank_scores:
            results: list[RetrievalResult] = []
            for (doc, score), rerank_score in zip(candidates, rerank_scores, strict=False):
                metadata = dict(doc.metadata or {})
                results.append(
                    RetrievalResult(
                        chunk_id=str(metadata.get("chunk_id", "")),
                        document_id=str(metadata.get("document_id", "")),
                        content=doc.page_content,
                        score=float(rerank_score),
                        metadata={
                            **metadata,
                            "vector_score": score,
                            "rerank_score": float(rerank_score),
                        },
                    )
                )
            results.sort(key=lambda item: item.score, reverse=True)
            return results[: min(self._settings.rerank_top_n, len(results))]
        return [
            RetrievalResult(
                chunk_id=str(dict(doc.metadata or {}).get("chunk_id", "")),
                document_id=str(dict(doc.metadata or {}).get("document_id", "")),
                content=doc.page_content,
                score=float(score),
                metadata=dict(doc.metadata or {}),
            )
            for doc, score in candidates
        ]
