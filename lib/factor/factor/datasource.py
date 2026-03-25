from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional

import pandas as pd


class FactorDataSource(ABC):
    """
    Abstract panel data provider for factors.

    Implementations should return a DataFrame indexed by MultiIndex (date, asset)
    with columns containing at least the requested ``fields``.

    Contract (mirror common backtest / evaluator usage):
    - ``window`` is the factor's lookback length (e.g. ``Factor.max_window``).
      Load enough history before ``start_date`` when ``start_date`` is set so
      rolling windows are valid on the first in-range date.
    - When ``stock_codes`` is None, load the full universe the implementation supports.
    """

    @abstractmethod
    def get_panel(
        self,
        *,
        fields: List[str],
        start_date: Optional[str],
        end_date: str,
        stock_codes: Optional[List[str]],
        window: int,
    ) -> pd.DataFrame:
        """
        Load OHLCV / feature columns for the given range and universe.

        Args:
            fields: Column names required by the factor (e.g. ``close``, ``turn``).
            start_date: First calendar date of interest (``YYYY-MM-DD``), or None
                to let the factor implementation / caller define range semantics.
            end_date: Last calendar date inclusive (``YYYY-MM-DD``).
            stock_codes: Asset identifiers, or None for full universe.
            window: Extra history length in trading days (or bars) that the
                implementation should honor before ``start_date`` when applicable.

        Returns:
            DataFrame with MultiIndex named ``date`` and ``asset`` (in any order
            of levels; ``Factor`` validates names) and columns covering ``fields``.
        """
        raise NotImplementedError
