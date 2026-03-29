import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agent_llm as agent_llm_router
from app.routers import agent_workflows as agent_workflows_router
from app.routers import data_sets as data_sets_router
from app.routers import datasources as datasources_router
from app.routers import evaluation_metrics as evaluation_metrics_router
from app.routers import evaluation_profiles as evaluation_profiles_router
from app.routers import factors as factors_router
from app.workspace_migrate import migrate_workspace_layout


@asynccontextmanager
async def _lifespan(application: FastAPI):
    migrate_workspace_layout()
    yield


app = FastAPI(title="quant-agent API", version="0.1.0", lifespan=_lifespan)
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
