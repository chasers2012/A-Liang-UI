from __future__ import annotations

from abc import ABC


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

    def on_registered(self) -> None:
        """Optional hook executed after this plugin is registered."""
        return
