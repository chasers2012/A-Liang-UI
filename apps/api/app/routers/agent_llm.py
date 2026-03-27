"""Read/write ``config/agent_llm.json`` for the factor agent CLI and web UI."""

from __future__ import annotations

from fastapi import APIRouter

from app.agent_llm_schemas import AgentLlmSettings
from app.workspace_config import load_workspace_config, save_workspace_config

router = APIRouter(prefix="/agent", tags=["agent"])

_CONFIG_FILE = "agent_llm.json"


def _defaults() -> AgentLlmSettings:
    return AgentLlmSettings()


@router.get("/llm-settings", response_model=AgentLlmSettings)
def get_llm_settings() -> AgentLlmSettings:
    return load_workspace_config(
        _CONFIG_FILE,
        AgentLlmSettings,
        default_factory=_defaults,
    )


@router.put("/llm-settings", response_model=AgentLlmSettings)
def put_llm_settings(body: AgentLlmSettings) -> AgentLlmSettings:
    save_workspace_config(_CONFIG_FILE, body)
    return body
