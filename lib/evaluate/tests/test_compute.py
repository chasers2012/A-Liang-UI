from __future__ import annotations

import pandas as pd
import pytest

from evaluate import (
    compute_factor_values,
    max_lookback,
    merged_dependencies,
)
from factor.core import Factor


class _DoubleClose(Factor):
    name = "double_close"
    dependencies = ["close"]
    max_window = 1

    def calc(self, data: pd.DataFrame) -> pd.Series:
        return data["close"] * 2.0


class _NeedsVol(Factor):
    name = "vol_tag"
    dependencies = ["close", "volume"]
    max_window = 5

    def calc(self, data: pd.DataFrame) -> pd.Series:
        return data["volume"].astype(float)


def _sample_panel() -> pd.DataFrame:
    idx = pd.MultiIndex.from_tuples(
        [
            ("2024-01-01", "AAA"),
            ("2024-01-01", "BBB"),
            ("2024-01-02", "AAA"),
        ],
        names=["date", "asset"],
    )
    return pd.DataFrame(
        {"close": [10.0, 20.0, 11.0], "volume": [100, 200, 110]},
        index=idx,
    )


def test_merged_dependencies_order_and_dedup() -> None:
    f1 = _DoubleClose()
    f2 = _NeedsVol()
    assert merged_dependencies([f1, f2]) == ["close", "volume"]
    assert merged_dependencies([f2, f1]) == ["close", "volume"]


def test_max_lookback() -> None:
    assert max_lookback([]) == 1
    assert max_lookback([_DoubleClose(), _NeedsVol()]) == 5


def test_compute_factor_values_wide_frame() -> None:
    panel = _sample_panel()
    f1 = _DoubleClose()
    f2 = _NeedsVol()
    out = compute_factor_values([f1, f2], panel)
    assert list(out.columns) == ["double_close", "vol_tag"]
    assert out["double_close"].tolist() == [20.0, 40.0, 22.0]
    assert out.index.equals(panel.index)


def test_compute_factor_values_empty_factors() -> None:
    panel = _sample_panel()
    out = compute_factor_values([], panel)
    assert out.columns.tolist() == []
    assert out.index.equals(panel.index)


def test_compute_factor_values_missing_column_raises() -> None:
    panel = _sample_panel().drop(columns=["volume"])
    with pytest.raises(ValueError, match="missing required columns"):
        compute_factor_values([_NeedsVol()], panel)
