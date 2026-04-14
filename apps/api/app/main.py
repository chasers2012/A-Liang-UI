import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from inspect import isawaitable, iscoroutinefunction
from pathlib import Path

# Imports must follow bootstrap so workspace node packages exist before routers load catalogs.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.persistence
import app.plugin
from app.agent_workflows import api as agent_workflows_router
from app.backtest import api as backtests_router
from app.chat import api as agent_llm_router
from app.config import api as config_router
from app.data_set import api as data_sets_router
from app.datasource import api as datasources_router
from app.evaluation.profile import api as evaluation_profiles_router
from app.evaluation.run import api as evaluation_runs_router
from app.factors import api as factors_router
from app.nodes import api as nodes_router
from app.preprocessors import api as preprocessors_router
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


_bootstrap_env()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    for job in STARTUP_JOBS:
        try:
            if iscoroutinefunction(job):
                await job()  # type: ignore[misc]
            else:
                result = job()
                if isawaitable(result):
                    await result  # type: ignore[misc]
        except Exception:
            # Startup jobs are best-effort; failures should not crash the app.
            # If needed, integrate with the project's logging solution here.
            continue

    yield


app = FastAPI(title="quant-agent API", version="0.1.0", lifespan=lifespan)
app.include_router(agent_llm_router.router)
app.include_router(config_router.router)
app.include_router(agent_workflows_router.router)
app.include_router(datasources_router.router)
app.include_router(nodes_router.router)
app.include_router(evaluation_profiles_router.router)
app.include_router(evaluation_runs_router.router)
app.include_router(backtests_router.router)
app.include_router(data_sets_router.router)
app.include_router(factors_router.router)
app.include_router(preprocessors_router.router)
app.include_router(strategies_router.router)
app.include_router(tools_router.router)
app.include_router(uploads_router.router)

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

    print(f"Starting quant-agent API on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level=log_level)
