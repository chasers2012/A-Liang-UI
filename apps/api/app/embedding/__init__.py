"""Embedding provider module."""

from app.startup_jobs import register_startup_job

from .config import register_embedding_settings_module
from .controller import get_embeddings
from .plugins import EmbeddingPlugin, get_embedding_plugin, list_embedding_plugins


@register_startup_job
def register_embedding_settings_on_startup() -> None:
    register_embedding_settings_module()


__all__ = [
    "EmbeddingPlugin",
    "build_embedding_provider_schema",
    "get_embedding_plugin",
    "get_embeddings",
    "list_embedding_plugins",
    "refresh_embedding_settings_module",
]
