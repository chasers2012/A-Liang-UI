from __future__ import annotations

from langchain_classic.retrievers.document_compressors import CrossEncoderReranker

from app.packages.config.controller import get_module_config

from .config import register_rerank_settings_module
from .plugins import get_rerank_plugin


def get_reranker(*, top_n: int) -> CrossEncoderReranker:
    register_rerank_settings_module()
    settings = get_module_config("rerank")
    provider_value = settings.get("rerank_provider")
    provider = str(provider_value).strip() if provider_value else ""
    if not provider:
        raise ValueError("Rerank provider 未配置：请先安装并配置 Rerank Provider 插件。")
    providers = settings.get("rerank_providers")
    if not isinstance(providers, dict):
        raise ValueError("Rerank providers 配置缺失：请在配置中填写 rerank_providers.<provider>。")
    cfg = providers.get(provider)
    if not isinstance(cfg, dict):
        raise ValueError(f"Rerank providers.{provider} 配置缺失：请完善该 provider 配置。")
    plugin = get_rerank_plugin(provider)
    return plugin.create_reranker(dict(cfg), top_n=top_n)
