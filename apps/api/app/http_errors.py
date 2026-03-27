"""Map domain errors to FastAPI HTTP responses."""

from __future__ import annotations

from typing import NoReturn

from fastapi import HTTPException


def http_bad_request(exc: ValueError) -> NoReturn:
    raise HTTPException(status_code=400, detail=str(exc)) from exc


def http_internal_server_error(exc: ValueError) -> NoReturn:
    raise HTTPException(status_code=500, detail=str(exc)) from exc
