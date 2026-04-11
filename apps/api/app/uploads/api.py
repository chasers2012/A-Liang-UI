from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from app.uploads.controller import upload_file as upload_file_controller
from app.uploads.schemas import UploadFileResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/file", response_model=UploadFileResponse)
async def upload_file(file: UploadFile = File(...)) -> UploadFileResponse:
    return await upload_file_controller(file)
