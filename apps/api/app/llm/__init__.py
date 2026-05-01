"""LLM configuration and model factory utilities.

This module centralizes:
- Settings schema/registration
- Provider/model resolution
- Chat model factory used across the API
"""

from .chat_model import build_chat_model
from .config import LlmSettings, get_llm_settings, register_llm_settings_module
from .plugins import LlmPlugin, get_llm_plugin, list_llm_plugins

__all__ = [
    "LlmPlugin",
    "LlmSettings",
    "build_chat_model",
    "get_llm_plugin",
    "get_llm_settings",
    "list_llm_plugins",
    "register_llm_settings_module",
]
