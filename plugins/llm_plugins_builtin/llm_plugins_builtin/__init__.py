"""Built-in LLM provider plugins for quant-agent."""

from .deepseek import DeepSeekLlmPlugin
from .ollama import OllamaLlmPlugin
from .openai import OpenAiLlmPlugin

__all__ = ["DeepSeekLlmPlugin", "OllamaLlmPlugin", "OpenAiLlmPlugin"]
