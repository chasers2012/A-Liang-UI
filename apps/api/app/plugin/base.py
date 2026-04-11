from __future__ import annotations

import inspect
from abc import ABC
from typing import Any


class Plugin(ABC):
    """
    Base class for quant-agent plugins.

    Subclasses must define non-empty string class attributes ``name`` (registry key)
    and ``category`` (grouping, e.g. ``"datasource"``). Abstract intermediates may omit
    ``name`` if they only set ``category`` for concrete subclasses to inherit.

    Config validation and UI schema live on config-specific subclasses
    (e.g. :class:`app.datasource.plugins.DataSourcePlugin`).
    """

    name: str
    category: str

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if inspect.isabstract(cls):
            return
        n = getattr(cls, "name", None)
        if not isinstance(n, str) or not n.strip():
            raise TypeError(f"{cls.__qualname__} must define non-empty class attribute 'name: str'")
        c = getattr(cls, "category", None)
        if not isinstance(c, str) or not c.strip():
            raise TypeError(
                f"{cls.__qualname__} must define non-empty class attribute 'category: str'"
            )
