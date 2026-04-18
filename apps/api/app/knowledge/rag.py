from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from langchain_chroma import Chroma
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEmbeddings
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
        self._splitter: RecursiveCharacterTextSplitter | None = None
        self._reranker: Any = None
        persist_dir = workspace_path("data/knowledge/chroma")
        persist_dir.mkdir(parents=True, exist_ok=True)
        self._store = Chroma(
            collection_name=self._settings.collection_name,
            embedding_function=self._embedding,
            persist_directory=persist_dir.as_posix(),
        )
        self.__class__._initialized = True

    @property
    def splitter(self) -> RecursiveCharacterTextSplitter:
        if self._splitter is None:
            self._splitter = RecursiveCharacterTextSplitter(
                chunk_size=self._settings.chunk_size,
                chunk_overlap=self._settings.chunk_overlap,
            )
        return self._splitter

    @property
    def reranker(self) -> CrossEncoderReranker:
        if self._reranker is None:
            model = HuggingFaceCrossEncoder(model_name=self._settings.rerank_model)
            self._reranker = CrossEncoderReranker(model=model, top_n=self._settings.rerank_top_n)
        return self._reranker

    def split_text(self, text: str) -> list[str]:
        return [piece.strip() for piece in self.splitter.split_text(text) if piece.strip()]

    def upsert_chunks(
        self,
        *,
        document_id: str,
        chunks: list[str],
        chunk_ids: list[str],
        base_metadata: dict[str, Any],
    ) -> list[Document]:
        documents = []
        ids: list[str] = []
        for idx, content in enumerate(chunks):
            chunk_id = chunk_ids[idx] if idx < len(chunk_ids) else f"{document_id}:{idx}"
            ids.append(chunk_id)
            documents.append(
                Document(
                    page_content=content,
                    metadata={
                        **base_metadata,
                        "document_id": document_id,
                        "chunk_index": idx,
                        "chunk_id": chunk_id,
                    },
                )
            )
        if ids:
            self._store.delete(ids=ids)
            self._store.add_documents(documents=documents, ids=ids)
        return documents

    def delete_document(self, chunk_ids: list[str]) -> None:
        if not chunk_ids:
            return
        self._store.delete(ids=chunk_ids)

    def _score_pairs(self, query: str, docs: list[Document]) -> list[float]:
        try:
            compressed = self.reranker.compress_documents(docs, query)
        except Exception:
            return []
        scores: list[float] = []
        for idx, doc in enumerate(compressed):
            metadata = dict(doc.metadata or {})
            score = metadata.get("relevance_score", metadata.get("score", len(compressed) - idx))
            scores.append(float(score))
        return scores

    def _build_bm25_retriever(self, documents: list[Document]) -> BM25Retriever:
        retriever = BM25Retriever.from_documents(documents)
        retriever.k = self._settings.top_k
        return retriever

    def _load_documents(self, document_ids: set[str] | None = None) -> list[Document]:
        payload = self._store.get(include=["documents", "metadatas"])
        texts = payload.get("documents") or []
        metadatas = payload.get("metadatas") or []
        documents: list[Document] = []
        for text, metadata in zip(texts, metadatas, strict=False):
            doc_metadata = dict(metadata or {})
            if document_ids and str(doc_metadata.get("document_id", "")) not in document_ids:
                continue
            documents.append(Document(page_content=text, metadata=doc_metadata))
        return documents

    def _normalize_results(
        self,
        *,
        query: str,
        docs: list[Document],
    ) -> list[RetrievalResult]:
        if not docs:
            return []

        rerank_scores = self._score_pairs(query, docs)
        results: list[RetrievalResult] = []
        for idx, doc in enumerate(docs):
            metadata = dict(doc.metadata or {})
            rerank_score = (
                rerank_scores[idx] if idx < len(rerank_scores) else float(len(docs) - idx)
            )
            results.append(
                RetrievalResult(
                    chunk_id=str(metadata.get("chunk_id", "")),
                    document_id=str(metadata.get("document_id", "")),
                    content=doc.page_content,
                    score=float(rerank_score),
                    metadata={
                        **metadata,
                        "rerank_score": float(rerank_score),
                    },
                )
            )
        results.sort(key=lambda item: item.score, reverse=True)
        return results[: min(self._settings.rerank_top_n, len(results))]

    def retrieve(
        self,
        *,
        query: str,
        top_k: int,
        threshold: float,
        document_ids: list[str] | None = None,
    ) -> list[RetrievalResult]:
        allowed = set(document_ids or []) or None
        documents = self._load_documents(allowed)
        if not documents:
            return []

        bm25 = self._build_bm25_retriever(documents)

        bm25_docs = bm25.invoke(query)[:top_k]
        vector_pairs = self._store.similarity_search_with_relevance_scores(query=query, k=top_k)

        merged_docs: list[Document] = []
        seen_chunk_ids: set[str] = set()

        for doc in bm25_docs + [doc for doc, score in vector_pairs if float(score) >= threshold]:
            metadata = dict(doc.metadata or {})
            if allowed and str(metadata.get("document_id", "")) not in allowed:
                continue
            chunk_id = str(metadata.get("chunk_id", ""))
            if not chunk_id or chunk_id in seen_chunk_ids:
                continue
            seen_chunk_ids.add(chunk_id)
            merged_docs.append(doc)

        return self._normalize_results(query=query, docs=merged_docs)
