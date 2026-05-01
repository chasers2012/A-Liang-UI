"""Built-in LLM provider plugins for quant-agent."""

from .ollama import OllamaLlmPlugin
from .openai import OpenAiLlmPlugin

__all__ = ["OllamaLlmPlugin", "OpenAiLlmPlugin"]
