from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from factor.data_set import DataSet


@dataclass(frozen=True)
class MarketData:
    close: pd.DataFrame | None = None
    open: pd.DataFrame | None = None
    high: pd.DataFrame | None = None
    low: pd.DataFrame | None = None


def _to_wide_panel_field(panel: pd.DataFrame, field: str) -> pd.DataFrame:
    out = panel[field].unstack("asset").sort_index()
    out.index.name = "date"
    out.columns = [str(c) for c in out.columns]
    return out


def load_market_data(
    ds: DataSet,
    *,
    start: str | None = None,
    end: str | None = None,
    instrument_codes: list[str] | None = None,
) -> MarketData:
    panel = ds.get_panel(
        fields=["close", "open", "high", "low"],
        window=1,
        start_date=start,
        end_date=end,
        instrument_codes=instrument_codes,
    )
    available_fields = set(panel.columns.get_level_values(0))
    extracted: dict[str, pd.DataFrame] = {}
    for field in ("close", "open", "high", "low"):
        if field in available_fields:
            extracted[field] = _to_wide_panel_field(panel, field)

    return MarketData(
        close=extracted.get("close"),
        open=extracted.get("open"),
        high=extracted.get("high"),
        low=extracted.get("low"),
    )
