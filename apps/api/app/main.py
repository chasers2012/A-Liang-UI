import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import datasources as datasources_router
from app.routers import evaluation_test_sets as evaluation_test_sets_router
from app.routers import factors as factors_router

app = FastAPI(title="quant-agent API", version="0.1.0")
app.include_router(datasources_router.router)
app.include_router(evaluation_test_sets_router.router)
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
