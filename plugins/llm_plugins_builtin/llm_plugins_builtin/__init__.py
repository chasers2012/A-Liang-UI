"""Built-in LLM provider plugins for quant-agent."""

from .anthropic import AnthropicLlmPlugin
from .deepseek import DeepSeekLlmPlugin
from .ollama import OllamaLlmPlugin
from .openai import OpenAiLlmPlugin

__all__ = ["AnthropicLlmPlugin", "DeepSeekLlmPlugin", "OllamaLlmPlugin", "OpenAiLlmPlugin"]
