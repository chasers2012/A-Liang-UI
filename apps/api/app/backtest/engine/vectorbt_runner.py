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
    initial_cash: float,
    fees: float,
    slippage: float,
    freq: str = "1D",
    from_signals_kwargs: dict[str, Any] | None = None,
) -> Portfolio:
    import vectorbt as vbt

    # Align inputs
    px = price.sort_index()
    ent = entries.reindex(px.index).reindex(columns=px.columns).fillna(False).astype(bool)
    ex = exits.reindex(px.index).reindex(columns=px.columns).fillna(False).astype(bool)

    kwargs = dict(from_signals_kwargs or {})

    return vbt.Portfolio.from_signals(
        px,
        ent,
        ex,
        group_by=bool(kwargs.pop("group_by", True)),
        cash_sharing=bool(kwargs.pop("cash_sharing", True)),
        init_cash=float(initial_cash),
        fees=float(fees),
        slippage=float(slippage),
        freq=str(kwargs.pop("freq", freq)),
        **kwargs,
    )
