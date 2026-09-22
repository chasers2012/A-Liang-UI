from __future__ import annotations

from abc import abstractmethod
from contextlib import suppress
from typing import Any, ClassVar

from langchain_core.embeddings import Embeddings

from app.infra.form import FormSchema
from app.infra.plugin.base import Plugin
from app.infra.plugin.registry import PluginRegistry, load_plugins_from_entry_points

__all__ = [
    "EmbeddingPlugin",
    "UnknownEmbeddingProviderError",
    "get_embedding_plugin",
    "list_embedding_plugins",
]


class UnknownEmbeddingProviderError(RuntimeError):
    def __init__(self, provider: str):
        super().__init__(f"Unknown embedding provider: {provider!r}")
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


class EmbeddingPlugin(Plugin):
    """
    Embedding provider plugin.

    Responsibilities:
    - Define provider-specific config schema for UI rendering
    - Validate/normalize provider config
    - Convert settings dict into LangChain Embeddings instance
    """

    category = "embedding"
    config: ClassVar[FormSchema | None] = None

    def get_config_schema(self) -> FormSchema | None:
        return self.config

    @abstractmethod
    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize provider-specific config."""

    @abstractmethod
    def create_embeddings(self, settings: dict[str, Any]) -> Embeddings:
        """Build a LangChain Embeddings instance from provider-specific settings."""


def get_embedding_plugin(provider: str) -> EmbeddingPlugin:
    _ensure_plugins_loaded()
    p = PluginRegistry.instance().get("embedding", str(provider).strip())
    if not p:
        raise UnknownEmbeddingProviderError(str(provider))
    if not isinstance(p, EmbeddingPlugin):
        raise TypeError(
            f"Plugin {provider!r} is not an EmbeddingPlugin (got {type(p).__qualname__})"
        )
    return p


def list_embedding_plugins() -> list[EmbeddingPlugin]:
    _ensure_plugins_loaded()
    items = PluginRegistry.instance().list_registered_by_category("embedding")
    out: list[EmbeddingPlugin] = []
    for _name, plugin in items:
        if isinstance(plugin, EmbeddingPlugin):
            out.append(plugin)
    return out
