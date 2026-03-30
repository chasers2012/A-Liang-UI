import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from inspect import isawaitable, iscoroutinefunction

from app.startup_jobs import STARTUP_JOBS
from app.workflow_nodes.seed_builtin import ensure_all_builtin_workflow_domains

ensure_all_builtin_workflow_domains()

# Imports must follow bootstrap so workspace node packages exist before routers load catalogs.
from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.routers import agent_llm as agent_llm_router  # noqa: E402
from app.routers import agent_workflows as agent_workflows_router  # noqa: E402
from app.routers import data_sets as data_sets_router  # noqa: E402
from app.routers import datasources as datasources_router  # noqa: E402
from app.routers import evaluation_metrics as evaluation_metrics_router  # noqa: E402
from app.routers import evaluation_profiles as evaluation_profiles_router  # noqa: E402
from app.routers import factors as factors_router  # noqa: E402


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
app.include_router(agent_workflows_router.router)
app.include_router(datasources_router.router)
app.include_router(evaluation_metrics_router.router)
app.include_router(evaluation_profiles_router.router)
app.include_router(data_sets_router.router)
app.include_router(factors_router.router)

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
