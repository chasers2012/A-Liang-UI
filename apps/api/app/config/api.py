from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import controller
from app.config.schema import ConfigSpecsResponse, ConfigValuesResponse

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/specs", response_model=ConfigSpecsResponse)
def get_config_specs() -> ConfigSpecsResponse:
    return ConfigSpecsResponse(items=controller.list_specs())


@router.get("/{module_key}", response_model=ConfigValuesResponse)
def get_config_values(module_key: str) -> ConfigValuesResponse:
    values = controller.get_module_config(module_key)
    return ConfigValuesResponse(module_key=module_key, values=values)


@router.put("/{module_key}", response_model=ConfigValuesResponse)
def put_config_values(module_key: str, body: dict[str, Any]) -> ConfigValuesResponse:
    try:
        values = controller.put_module_config(module_key, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ConfigValuesResponse(module_key=module_key, values=values)
