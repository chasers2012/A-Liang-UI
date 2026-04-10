from __future__ import annotations

import inspect
from abc import ABC, abstractmethod
from typing import Any, ClassVar

from app.plugin.schema import PluginConfigSchema


class Plugin(ABC):
    """
    Base class for config-driven plugins (validation, optional UI schema).

    Subclasses must define a non-empty string ``type`` and implement abstract methods.
    """

    type: str
    catelog: str
    config: ClassVar[PluginConfigSchema | None] = None

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if inspect.isabstract(cls):
            return
        t = getattr(cls, "type", None)
        if not isinstance(t, str) or not t.strip():
            raise TypeError(f"{cls.__qualname__} must define non-empty class attribute 'type: str'")

    @abstractmethod
    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize config. Must return a JSON-serializable dict."""

    def get_config_schema(self) -> PluginConfigSchema | None:
        """Optional UI schema for rendering a config form (from class ``config``)."""
        return self.config
