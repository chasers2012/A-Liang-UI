import logging
import logging.config
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from inspect import isawaitable, iscoroutinefunction
from pathlib import Path

import yaml

# Imports must follow bootstrap so workspace node packages exist before routers load catalogs.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from workspace import workspace_path

import app.llm_tools
import app.persistence
import app.plugin
import app.scheduler
from app.agents import api as agents_router
from app.backtest import api as backtests_router
from app.chat import api as agent_llm_router
from app.config import api as config_router
from app.data_set import api as data_sets_router
from app.data_sync import api as data_sync_router
from app.datasource import api as datasources_router
from app.evaluation.profile import api as evaluation_profiles_router
from app.evaluation.run import api as evaluation_runs_router
from app.events import api as events_router
from app.factors import api as factors_router
from app.knowledge import api as knowledge_router
from app.nodes import api as nodes_router
from app.scheduler import api as scheduler_router
from app.startup_jobs import STARTUP_JOBS
from app.strategy import api as strategies_router
from app.tool import api as tools_router
from app.uploads import api as uploads_router


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def _bootstrap_env() -> None:
    # Prefer app-level .env.local, then root .env.local, then examples.
    app_root = Path(__file__).resolve().parents[2]
    repo_root = Path(__file__).resolve().parents[3]
    for candidate in (
        app_root / ".env.local",
        repo_root / ".env.local",
        app_root / ".env.example",
        repo_root / ".env.example",
    ):
        _load_env_file(candidate)


def _get_uvicorn_log_config(config_path: Path) -> dict[str, object] | None:
    if not config_path.is_file():
        return None

    loaded = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise ValueError(f"Invalid log config yaml, expected mapping: {config_path}")

    log_file = workspace_path("logs", "api", os.getenv("API_LOG_FILE", "api.log"))
    log_file.parent.mkdir(parents=True, exist_ok=True)

    handlers = loaded.get("handlers")
    if isinstance(handlers, dict):
        file_handler = handlers.get("file")
        if isinstance(file_handler, dict):
            file_handler["filename"] = str(log_file)

    return loaded


_bootstrap_env()
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting quant-agent API application")
    for job in STARTUP_JOBS:
        try:
            if iscoroutinefunction(job):
                await job()  # type: ignore[misc]
            else:
                result = job()
                if isawaitable(result):
                    await result  # type: ignore[misc]
        except Exception:
            logger.exception("Startup job failed")
            continue

    yield
    logger.info("Stopping quant-agent API application")


app = FastAPI(title="quant-agent API", version="0.1.0", lifespan=lifespan)
app.include_router(agents_router.router)
app.include_router(agent_llm_router.router)
app.include_router(config_router.router)
app.include_router(datasources_router.router)
app.include_router(nodes_router.router)
app.include_router(evaluation_profiles_router.router)
app.include_router(evaluation_runs_router.router)
app.include_router(backtests_router.router)
app.include_router(data_sets_router.router)
app.include_router(data_sync_router.router)
app.include_router(events_router.router)
app.include_router(factors_router.router)
app.include_router(knowledge_router.router)
app.include_router(scheduler_router.router)
app.include_router(strategies_router.router)
app.include_router(tools_router.router)
app.include_router(uploads_router.router)

_gzip_min_size = int(os.getenv("GZIP_MIN_SIZE", "1024"))
app.add_middleware(GZipMiddleware, minimum_size=_gzip_min_size)

_origins = os.getenv("CORS_ORIGINS", "*")
_origins_list = [o.strip() for o in _origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "quant-agent-api"}


if __name__ == "__main__":
    # Allow `python app/main.py` to start the API directly.
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    log_level = os.getenv("LOG_LEVEL", "info")
    log_config_path = Path(__file__).resolve().with_name("log_conf.yaml")
    log_config = _get_uvicorn_log_config(log_config_path)

    logger.info("Starting quant-agent API on http://%s:%s", host, port)
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=log_level,
        log_config=log_config,
    )
