from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from workspace import workspace_path

from app.uploads.schemas import UploadFileResponse


async def upload_file(file: UploadFile) -> UploadFileResponse:
    picked_name = Path(file.filename or "upload.bin").name
    if not picked_name:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    upload_dir = workspace_path("uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}_{picked_name}"
    target = upload_dir / stored_name
    data = await file.read()
    target.write_bytes(data)
    return UploadFileResponse(
        path=f"uploads/{stored_name}",
        filename=picked_name,
        size=len(data),
    )
