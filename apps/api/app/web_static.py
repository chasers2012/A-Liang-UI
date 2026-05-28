from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, RedirectResponse

from app.paths import WEB_UI_PREFIX

logger = logging.getLogger(__name__)


def resolve_web_dist_dir() -> Path:
    raw = os.getenv("WEB_DIST_DIR", "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "web" / "out"


def resolve_web_ui_prefix() -> str:
    raw = os.getenv("WEB_UI_PREFIX", WEB_UI_PREFIX).strip()
    return raw.rstrip("/")


def mount_web_static(app: FastAPI) -> None:
    dist = resolve_web_dist_dir()
    index = dist / "index.html"
    if not index.is_file():
        logger.warning("Web static export not found at %s; API-only mode", dist)
        return

    ui_prefix = resolve_web_ui_prefix()
    mount_path = ui_prefix or "/"

    if ui_prefix:

        @app.get("/", include_in_schema=False)
        async def redirect_root() -> RedirectResponse:
            return RedirectResponse(url=f"{ui_prefix}/", status_code=307)

        @app.get(ui_prefix, include_in_schema=False)
        @app.get(f"{ui_prefix}/", include_in_schema=False)
        async def web_index() -> FileResponse:
            return FileResponse(index)

    app.mount(mount_path, StaticFiles(directory=dist, html=True), name="web")
    logger.info("Serving web static files at %s from %s", mount_path, dist)
