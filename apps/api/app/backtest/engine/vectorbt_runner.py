from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pandas as pd

if TYPE_CHECKING:
    from vectorbt.portfolio.base import Portfolio


def run_portfolio_from_signals(
    *,
    price: pd.DataFrame,
    entries: pd.DataFrame,
    exits: pd.DataFrame,
    **kwargs: Any,
) -> Portfolio:
    import vectorbt as vbt

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
