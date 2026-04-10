from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from app.datasource.schemas import DatasourceUploadFileResponse
from app.uploads.controller import upload_file as upload_file_controller

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/file", response_model=DatasourceUploadFileResponse)
async def upload_file(file: UploadFile = File(...)) -> DatasourceUploadFileResponse:
    return await upload_file_controller(file)
