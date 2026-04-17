from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import UploadFile

try:
    from unstructured.partition.auto import partition  # type: ignore[import-not-found]
except Exception as exc:  # pragma: no cover - import guard
    partition = None  # type: ignore[assignment]
    _UNSTRUCTURED_IMPORT_ERROR = exc
else:
    _UNSTRUCTURED_IMPORT_ERROR = None


class KnowledgeParseError(ValueError):
    pass


async def extract_text(upload_file: UploadFile) -> tuple[str, str]:
    if partition is None:
        raise KnowledgeParseError(f"Unstructured 未安装或不可用: {_UNSTRUCTURED_IMPORT_ERROR}")

    filename = upload_file.filename or "uploaded-file"
    suffix = Path(filename).suffix.lower() or ".bin"

    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / f"input{suffix}"
        data = await upload_file.read()
        tmp_path.write_bytes(data)

        try:
            elements = partition(filename=str(tmp_path))
        except Exception as exc:
            raise KnowledgeParseError(f"文件解析失败: {exc}") from exc

    text = "\n".join(
        element.text.strip()
        for element in elements
        if getattr(element, "text", None) and str(element.text).strip()
    ).strip()
    if not text:
        raise KnowledgeParseError("未能从文件中提取到正文内容")

    return text, filename
