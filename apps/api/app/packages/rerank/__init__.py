"""Rerank provider module."""

from app.startup_jobs import register_startup_job

from .config import register_rerank_settings_module
from .controller import get_reranker
from .plugins import RerankPlugin, get_rerank_plugin, list_rerank_plugins


@register_startup_job
def register_rerank_settings_on_startup() -> None:
    register_rerank_settings_module()


__all__ = [
    "RerankPlugin",
    "get_rerank_plugin",
    "get_reranker",
    "list_rerank_plugins",
    "register_rerank_settings_module",
]
