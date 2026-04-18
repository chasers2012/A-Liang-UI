from __future__ import annotations

import os
from dataclasses import dataclass

import pytest

pytest.importorskip("ragas")
pytest.importorskip("datasets")

from app.knowledge.rag import VectorStoreAdapter
from app.knowledge.schemas import KnowledgeSettings
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import ContextPrecision, ContextRecall, Faithfulness


@dataclass(frozen=True)
class EvalCase:
    question: str
    answer: str
    contexts: list[str]
    ground_truth: list[str]


@pytest.fixture(scope="module")
def ragas_cases() -> list[EvalCase]:
    return [
        EvalCase(
            question="量化策略回测需要哪些核心输入？",
            answer="回测通常需要历史行情数据、交易规则、手续费滑点假设和初始资金。",
            contexts=[
                "回测的核心输入包括历史行情数据、交易规则、手续费和滑点假设。",
                "初始化资金与仓位限制也会影响回测结果。",
            ],
            ground_truth=[
                "回测需要历史行情数据、交易规则、手续费滑点假设和初始资金。",
            ],
        ),
        EvalCase(
            question="知识库检索返回结果时，怎样避免重复 chunk？",
            answer="可以通过 chunk_id 去重，再对融合后的候选结果 rerank。",
            contexts=[
                "检索时先合并 BM25 与向量召回结果，再通过 chunk_id 去重。",
                "对去重后的候选结果执行 rerank 后返回 top_n。",
            ],
            ground_truth=[
                "可以通过 chunk_id 去重，再对融合后的候选结果 rerank。",
            ],
        ),
    ]


@pytest.fixture(scope="module")
def ragas_dataset(ragas_cases: list[EvalCase]) -> Dataset:
    return Dataset.from_dict(
        {
            "question": [case.question for case in ragas_cases],
            "answer": [case.answer for case in ragas_cases],
            "contexts": [case.contexts for case in ragas_cases],
            "ground_truths": [case.ground_truth for case in ragas_cases],
            "reference": [case.ground_truth[0] for case in ragas_cases],
        }
    )


@pytest.mark.skipif(
    os.getenv("RUN_RAGAS_EVAL", "0") != "1",
    reason="set RUN_RAGAS_EVAL=1 to run the RAGAS evaluation locally",
)
def test_knowledge_rag_ragas_eval(ragas_dataset: Dataset) -> None:
    result = evaluate(
        ragas_dataset,
        metrics=[ContextPrecision(), ContextRecall(), Faithfulness()],
    )
    print("RAGAS result:")
    print(result)
    assert result is not None


@pytest.mark.skipif(
    os.getenv("RUN_RAGAS_SMOKE", "0") != "1",
    reason="set RUN_RAGAS_SMOKE=1 to run the smoke retrieval check",
)
def test_vector_store_adapter_smoke() -> None:
    settings = KnowledgeSettings()
    adapter = VectorStoreAdapter(settings)

    chunks = [
        "回测需要历史行情、交易规则、手续费和滑点假设。",
        "检索结果会先合并，再基于 chunk_id 去重。",
    ]
    docs = adapter.upsert_chunks(
        document_id="ragas-smoke-doc",
        chunks=chunks,
        base_metadata={"document_name": "ragas smoke"},
    )

    try:
        retrievals = adapter.retrieve(
            query="回测需要哪些输入？",
            top_k=4,
            threshold=0.0,
            document_ids=["ragas-smoke-doc"],
        )
        assert retrievals
        assert any("回测" in item.content for item in retrievals)
    finally:
        adapter.delete_document("ragas-smoke-doc", chunk_count=len(docs))
