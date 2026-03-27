from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd


class FactorDataSource(ABC):
    """
    Abstract panel data provider for factors.

    Implementations should return a DataFrame indexed by MultiIndex (date, asset)
    with columns containing at least the requested ``fields``.

    :meth:`get_panel` receives an inclusive ``start_date`` that already includes
    any lookback history; typically :class:`DependencyResolver` or
    :func:`factor.dependency_resolver.panel_load_start_date` computes it from the
    user range and ``window``.
    """

    @abstractmethod
    def get_panel(
        self,
        *,
        fields: list[str],
        start_date: str,
        end_date: str,
        stock_codes: list[str] | None,
    ) -> pd.DataFrame:
        """
        Load OHLCV / feature columns for the given range and universe.

        Args:
            fields: Column names required by the factor (e.g. ``close``, ``turn``).
            start_date: First calendar date inclusive (``YYYY-MM-DD``), including
                history needed upstream for rolling windows.
            end_date: Last calendar date inclusive (``YYYY-MM-DD``).
            stock_codes: Asset identifiers, or None for full universe.

        Returns:
            DataFrame with MultiIndex named ``date`` and ``asset`` (in any order
            of levels; ``Factor`` validates names) and columns covering ``fields``.
        """
        raise NotImplementedError
