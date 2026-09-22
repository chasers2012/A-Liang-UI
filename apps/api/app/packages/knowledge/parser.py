from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from docling.chunking import HybridChunker
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    TableFormerMode,
    TableStructureOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.infra.llm import build_chat_model


class KnowledgeParseError(ValueError):
    pass


_docling_converter: DocumentConverter | None = None
_docling_chunker: HybridChunker | None = None
_logger = logging.getLogger(__name__)


class HeadingFixItem(BaseModel):
    id: int
    level: int
    title: str


class HeadingFixOutput(BaseModel):
    headings: list[HeadingFixItem]


HeadingPath = tuple[str, ...]
HeadingLevelPath = tuple[int, ...]


def _extract_markdown_headings(lines: list[str]) -> list[tuple[int, int, str]]:
    heading_rows: list[tuple[int, int, str]] = []
    in_code_block = False
    for idx, raw_line in enumerate(lines):
        stripped = raw_line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", raw_line)
        if not match:
            continue
        level = len(match.group(1))
        title = match.group(2).strip()
        if title:
            heading_rows.append((idx, level, title))
    return heading_rows


def _parse_heading_fix_result(
    output: HeadingFixOutput, heading_rows: list[tuple[int, int, str]]
) -> list[tuple[int, int, str]] | None:
    parsed = output.headings
    if len(parsed) != len(heading_rows):
        return None
    updated_rows: list[tuple[int, int, str]] = []
    for expected_id, item in enumerate(parsed):
        if int(item.id) != expected_id:
            return None
        level = int(item.level)
        level = min(6, max(1, level))
        # Keep the original heading text and only apply adjusted level.
        title = heading_rows[expected_id][2]
        updated_rows.append((heading_rows[expected_id][0], level, title))
    return updated_rows


def _rewrite_heading_lines(lines: list[str], updated_rows: list[tuple[int, int, str]]) -> str:
    for line_idx, level, title in updated_rows:
        lines[line_idx] = f"{'#' * level} {title}"
    return "\n".join(lines)


def _build_heading_level_lookup(markdown_text: str) -> dict[HeadingPath, HeadingLevelPath]:
    heading_rows = _extract_markdown_headings(markdown_text.splitlines())
    if not heading_rows:
        return {}
    stack: list[tuple[int, str]] = []
    mapping: dict[HeadingPath, HeadingLevelPath] = {}
    for _, level, title in heading_rows:
        while stack and stack[-1][0] >= level:
            stack.pop()
        stack.append((level, title))
        key = tuple(item[1] for item in stack)
        val = tuple(item[0] for item in stack)
        mapping[key] = val
    return mapping


def _get_docling_converter() -> DocumentConverter:
    global _docling_converter
    if _docling_converter is None:
        # Prefer faster table reconstruction for PDF ingestion:
        # - table mode "fast" sacrifices some structural precision for latency.
        # - cell matching off avoids extra alignment work.
        pdf_options = PdfPipelineOptions(
            do_ocr=False,
            table_structure_options=TableStructureOptions(
                mode=TableFormerMode.FAST,
                do_cell_matching=False,
            ),
        )
        _docling_converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_options),
            }
        )
    return _docling_converter


def _get_docling_chunker() -> HybridChunker:
    global _docling_chunker
    if _docling_chunker is None:
        _docling_chunker = HybridChunker()
    return _docling_chunker


def _contextualize_chunks(
    doc: object, *, heading_level_lookup: dict[HeadingPath, HeadingLevelPath] | None = None
) -> list[str]:
    chunker = _get_docling_chunker()
    chunks = list(chunker.chunk(dl_doc=doc))
    texts: list[str] = []
    for chunk in chunks:
        contextualized = chunker.contextualize(chunk=chunk).strip()
        if contextualized:
            texts.append(contextualized)
    texts = [text for text in texts if text]
    if not texts:
        raise KnowledgeParseError("Docling 未能从文件中提取到正文内容")
    return texts


def _normalize_markdown_headings_with_llm(markdown_text: str) -> str:
    if not markdown_text.strip():
        return markdown_text
    lines = markdown_text.splitlines()
    heading_rows = _extract_markdown_headings(lines)
    if not heading_rows:
        return markdown_text
    try:
        llm = build_chat_model()
        heading_payload = [
            {"id": row_id, "level": level, "title": title}
            for row_id, (_, level, title) in enumerate(heading_rows)
        ]
        prompt = (
            "请修复 Markdown 文档的标题层级。\n"
            "要求：\n"
            "1. 你只会收到标题列表，不会收到正文。\n"
            "2. 可以调整标题 level(1-6)，使结构更清晰。\n"
            "3. 每一项标题都可能过高或过低，需要联系整体的格式和语义将它修改到合适的层级\n"
            "4. 保持条目数量和 id 完全不变，不新增不删除。\n"
            "5. 不得修改标题title文本"
        )
        structured_llm = llm.with_structured_output(HeadingFixOutput)
        result = structured_llm.invoke(
            [
                SystemMessage(content="你是 Markdown 文档结构整理助手。"),
                HumanMessage(
                    content=(
                        f"{prompt}\n\n"
                        f"输入标题列表(JSON):\n{json.dumps(heading_payload, ensure_ascii=False)}"
                    )
                ),
            ],
            config={"metadata": {"silent_stream": True}},
        )
        updated_rows = _parse_heading_fix_result(result, heading_rows)
        if not updated_rows:
            return markdown_text
        return _rewrite_heading_lines(lines, updated_rows)
    except Exception as exc:
        _logger.exception("使用 LLM 修复 Markdown 标题层级失败: %s", exc)
        return markdown_text


def extract_chunks_from_path(path: Path) -> tuple[list[str], str]:
    if not path.exists():
        raise KnowledgeParseError(f"文件不存在: {path}")
    converter = _get_docling_converter()
    parsed = converter.convert(str(path)).document
    markdown_text = parsed.export_to_markdown()
    markdown_text = _normalize_markdown_headings_with_llm(markdown_text)
    heading_level_lookup = _build_heading_level_lookup(markdown_text)
    doc = converter.convert_string(
        content=markdown_text,
        format=InputFormat.MD,
        name=f"{path.stem}.md",
    ).document
    texts = _contextualize_chunks(doc, heading_level_lookup=heading_level_lookup)
    return texts, path.name


def extract_chunks_from_text(text: str, *, filename: str = "content.md") -> tuple[list[str], str]:
    raw_text = text.strip()
    if not raw_text:
        raise KnowledgeParseError("文本内容为空")
    safe_name = Path(filename).name
    converter = _get_docling_converter()
    doc = converter.convert_string(content=raw_text, format=InputFormat.MD, name=safe_name).document
    heading_level_lookup = _build_heading_level_lookup(raw_text)
    texts = _contextualize_chunks(doc, heading_level_lookup=heading_level_lookup)
    return texts, safe_name
