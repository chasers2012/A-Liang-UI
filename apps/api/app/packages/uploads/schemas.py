from __future__ import annotations

from pydantic import BaseModel


class UploadFileResponse(BaseModel):
    path: str
    filename: str
    size: int
