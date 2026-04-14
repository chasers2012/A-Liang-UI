from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from factor.data_set import DataSet


@dataclass(frozen=True)
class MarketData:
    close: pd.DataFrame
    open: pd.DataFrame | None = None


def load_market_data(
    ds: DataSet,
    *,
    start: str | None = None,
    end: str | None = None,
    instrument_codes: list[str] | None = None,
) -> MarketData:
    panel = ds.get_panel(
        fields=["close", "open"],
        window=1,
        start_date=start,
        end_date=end,
        instrument_codes=instrument_codes,
    )
    close = panel["close"].unstack("asset").sort_index()
    close.index.name = "date"
    close.columns = [str(c) for c in close.columns]
    open_ = panel["open"].unstack("asset").sort_index()
    open_.index.name = "date"
    open_.columns = [str(c) for c in open_.columns]
    return MarketData(close=close, open=open_)
