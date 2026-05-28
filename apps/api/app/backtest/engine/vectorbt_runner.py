from __future__ import annotations

from typing import Any

import pandas as pd
import vectorbt as vbt
from vectorbt.portfolio.base import Portfolio


def run_portfolio_from_signals(
    *,
    price: pd.DataFrame,
    entries: pd.DataFrame,
    exits: pd.DataFrame,
    **kwargs: Any,
) -> Portfolio:
    # Align inputs
    px = price.sort_index()
    ent = entries.reindex(px.index).reindex(columns=px.columns).fillna(False).astype(bool)
    ex = exits.reindex(px.index).reindex(columns=px.columns).fillna(False).astype(bool)

    return vbt.Portfolio.from_signals(
        px,
        ent,
        ex,
        **kwargs,
    )
