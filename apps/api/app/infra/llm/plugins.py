from __future__ import annotations

from abc import abstractmethod
from contextlib import suppress
from typing import Any, ClassVar

from app.infra.form import FormSchema
from app.infra.plugin.base import Plugin
from app.infra.plugin.registry import PluginRegistry, load_plugins_from_entry_points

__all__ = [
    "LlmPlugin",
    "UnknownLlmProviderError",
    "get_llm_plugin",
    "list_llm_plugins",
]


class UnknownLlmProviderError(RuntimeError):
    def __init__(self, provider: str):
        super().__init__(f"Unknown llm provider: {provider!r}")
        self.provider = provider


_PLUGINS_LOADED = False


def _ensure_plugins_loaded() -> None:
    global _PLUGINS_LOADED
    if _PLUGINS_LOADED:
        return
    # Best-effort: mirror app.plugin startup-job behavior, but make LLM schema/model
    # code resilient when used outside FastAPI lifespan (scripts/tests).
    registry = PluginRegistry.instance()
    with suppress(Exception):
        load_plugins_from_entry_points(registry)

    _PLUGINS_LOADED = True


class LlmPlugin(Plugin):
    """
    LLM provider plugin.

    Responsibilities:
    - Define provider-specific config schema (for UI rendering)
    - Validate/normalize provider config
    - Convert settings dict into (model_spec, init_chat_model kwargs)
    """

    category = "llm"
    config: ClassVar[FormSchema | None] = None

    def get_config_schema(self) -> FormSchema | None:
        return self.config

    @abstractmethod
    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize provider-specific config."""

    @abstractmethod
    def to_chat_model_spec(self, settings: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        """
        Build LangChain model spec string and kwargs for ``init_chat_model``.

        `settings` contains both common fields (model, temperature, etc.) and
        provider-specific fields.
        """


def get_llm_plugin(provider: str) -> LlmPlugin:
    _ensure_plugins_loaded()
    p = PluginRegistry.instance().get("llm", str(provider).strip())
    if not p:
        raise UnknownLlmProviderError(str(provider))
    if not isinstance(p, LlmPlugin):
        raise TypeError(f"Plugin {provider!r} is not a LlmPlugin (got {type(p).__qualname__})")
    return p


def list_llm_plugins() -> list[LlmPlugin]:
    _ensure_plugins_loaded()
    items = PluginRegistry.instance().list_registered_by_category("llm")
    out: list[LlmPlugin] = []
    for _name, plugin in items:
        if isinstance(plugin, LlmPlugin):
            out.append(plugin)
    return out
