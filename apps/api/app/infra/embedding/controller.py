from __future__ import annotations

from langchain_core.embeddings import Embeddings

from app.infra.config.controller import get_module_config

from .config import register_embedding_settings_module
from .plugins import get_embedding_plugin


def get_embeddings() -> Embeddings:
    register_embedding_settings_module()
    settings = get_module_config("embedding")
    provider_value = settings.get("embedding_provider")
    provider = str(provider_value).strip() if provider_value else ""
    if not provider:
        raise ValueError("Embedding provider 未配置：请先安装并配置 Embedding Provider 插件。")
    providers = settings.get("embedding_providers")
    if not isinstance(providers, dict):
        raise ValueError(
            "Embedding providers 配置缺失：请在配置中填写 embedding_providers.<provider>。"
        )
    cfg = providers.get(provider)
    if not isinstance(cfg, dict):
        raise ValueError(f"Embedding providers.{provider} 配置缺失：请完善该 provider 配置。")
    plugin = get_embedding_plugin(provider)
    return plugin.create_embeddings(dict(cfg))
