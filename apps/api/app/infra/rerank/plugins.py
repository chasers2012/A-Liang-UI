from __future__ import annotations

from abc import abstractmethod
from contextlib import suppress
from typing import Any, ClassVar

from langchain_classic.retrievers.document_compressors import CrossEncoderReranker

from app.infra.form.schema import FormSchema
from app.infra.plugin.base import Plugin
from app.infra.plugin.registry import PluginRegistry, load_plugins_from_entry_points

__all__ = [
    "RerankPlugin",
    "UnknownRerankProviderError",
    "get_rerank_plugin",
    "list_rerank_plugins",
]


class UnknownRerankProviderError(RuntimeError):
    def __init__(self, provider: str):
        super().__init__(f"Unknown rerank provider: {provider!r}")
        self.provider = provider


_PLUGINS_LOADED = False


def _ensure_plugins_loaded() -> None:
    global _PLUGINS_LOADED
    if _PLUGINS_LOADED:
        return
    registry = PluginRegistry.instance()
    with suppress(Exception):
        load_plugins_from_entry_points(registry)
    _PLUGINS_LOADED = True


class RerankPlugin(Plugin):
    """
    Rerank provider plugin.

    Responsibilities:
    - Define provider-specific config schema for UI rendering
    - Validate/normalize provider config
    - Build LangChain CrossEncoderReranker from settings
    """

    category = "rerank"
    config: ClassVar[FormSchema | None] = None

    def get_config_schema(self) -> FormSchema | None:
        return self.config

    @abstractmethod
    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize provider-specific config."""

    @abstractmethod
    def create_reranker(self, settings: dict[str, Any], *, top_n: int) -> CrossEncoderReranker:
        """Build a CrossEncoderReranker from provider-specific settings."""


def get_rerank_plugin(provider: str) -> RerankPlugin:
    _ensure_plugins_loaded()
    p = PluginRegistry.instance().get("rerank", str(provider).strip())
    if not p:
        raise UnknownRerankProviderError(str(provider))
    if not isinstance(p, RerankPlugin):
        raise TypeError(f"Plugin {provider!r} is not a RerankPlugin (got {type(p).__qualname__})")
    return p


def list_rerank_plugins() -> list[RerankPlugin]:
    _ensure_plugins_loaded()
    items = PluginRegistry.instance().list_registered_by_category("rerank")
    out: list[RerankPlugin] = []
    for _name, plugin in items:
        if isinstance(plugin, RerankPlugin):
            out.append(plugin)
    return out
