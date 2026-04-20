from __future__ import annotations

from typing import TYPE_CHECKING

import pandas as pd

if TYPE_CHECKING:
    from vectorbt.portfolio.base import Portfolio


def run_portfolio_from_target_weights(
    *,
    price: pd.DataFrame,
    target_weights: pd.DataFrame,
    initial_cash: float,
    fees: float,
    slippage: float,
    freq: str = "1D",
) -> Portfolio:
    import vectorbt as vbt

    # Align inputs
    px = price.sort_index()
    w = target_weights.reindex(px.index)
    w = w.reindex(columns=px.columns)

    # Use target percent sizing: each timestamp's weights are desired portfolio weights.
    return vbt.Portfolio.from_orders(
        px,
        size=w,
        size_type="targetpercent",
        group_by=True,
        cash_sharing=True,
        init_cash=float(initial_cash),
        fees=float(fees),
        slippage=float(slippage),
        freq=freq,
    )
