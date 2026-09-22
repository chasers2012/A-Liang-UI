from __future__ import annotations

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel

from .config import get_llm_settings


def build_chat_model() -> BaseChatModel:
    model, kwargs = get_llm_settings()
    return init_chat_model(model, **kwargs)
