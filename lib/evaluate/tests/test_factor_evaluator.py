from __future__ import annotations

from typing import ClassVar

import numpy as np
import pandas as pd
from evaluate import (
    AlphalensFactorEvaluator,
    close_prices_wide,
    compute_forward_return_from_wide,
)
from factor import DependencyResolver, Factor, FactorDataSource


class _StaticPanelSource(FactorDataSource):
    """Test helper: return a fixed panel slice by date range and fields."""

    def __init__(self, panel: pd.DataFrame) -> None:
        self._panel = panel

    def get_panel(
        self,
        *,
        fields: list[str],
        start_date: str,
        end_date: str,
        stock_codes: list[str] | None,
    ) -> pd.DataFrame:
        df = self._panel
        d = df.index.get_level_values("date")
        ed = pd.Timestamp(end_date)
        sd = pd.Timestamp(start_date)
        mask = np.asarray((d >= sd) & (d <= ed), dtype=bool)
        if stock_codes is not None:
            mask &= df.index.get_level_values("asset").isin(stock_codes)
        return df.loc[mask, list(fields)]


class _RankFactor(Factor):
    name = "momentum_rank"
    dependencies: ClassVar[list[str]] = ["close"]
    max_window = 1

    def calc(self, data: pd.DataFrame) -> pd.Series:
        return data.groupby(level="date", group_keys=False)["close"].rank(pct=True)


def _panel_and_factor(
    *,
    n_dates: int = 40,
    n_assets: int = 8,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(0)
    dates = pd.date_range("2024-01-02", periods=n_dates, freq="B")
    assets = [f"S{i:03d}" for i in range(n_assets)]
    idx = pd.MultiIndex.from_product([dates, assets], names=["date", "asset"])
    # Random positive prices
    close = 10 + np.cumsum(rng.standard_normal(len(idx)) * 0.05)
    panel = pd.DataFrame({"close": close}, index=idx)
    # Cross-sectional rank as factor (no lookahead in this toy test)
    factor_vals = panel.groupby(level="date", group_keys=False)["close"].rank(pct=True)
    factor = factor_vals.to_frame("momentum_rank")
    return panel, factor


def _evaluator_for_panel(panel: pd.DataFrame) -> AlphalensFactorEvaluator:
    r = DependencyResolver()
    r.register_datasource(_StaticPanelSource(panel), ["close"])
    f = _RankFactor(dependency_resolver=r)
    dates = panel.index.get_level_values("date")
    start = dates.min().strftime("%Y-%m-%d")
    end = dates.max().strftime("%Y-%m-%d")
    return AlphalensFactorEvaluator(f, start_date=start, end_date=end)


def test_close_prices_wide_shape() -> None:
    panel, _ = _panel_and_factor(n_dates=5, n_assets=3)
    wide = close_prices_wide(panel)
    assert wide.shape == (5, 3)
    assert list(wide.columns) == ["S000", "S001", "S002"]


def test_compute_forward_return_from_wide() -> None:
    panel, _ = _panel_and_factor(n_dates=10, n_assets=2)
    wide = close_prices_wide(panel)
    s = compute_forward_return_from_wide(wide, period=1)
    assert isinstance(s.index, pd.MultiIndex)
    assert s.index.names == ["date", "asset"]


def test_alphalens_evaluator_close_and_alignment() -> None:
    panel, _ = _panel_and_factor()
    ev = _evaluator_for_panel(panel)
    wide = ev.get_close_wide()
    assert wide.shape[0] == panel.index.get_level_values("date").nunique()
    result = ev.evaluate_factor(quantiles=5, periods=(1, 5), max_loss=0.99)
    assert result.factor_frame.index.isin(ev.alignment_index()).all()


def test_evaluate_factor_alphalens_reloaded_smoke() -> None:
    panel, _ = _panel_and_factor(n_dates=50, n_assets=8)
    ev = _evaluator_for_panel(panel)
    out = ev.evaluate_factor(quantiles=5, periods=(1, 5, 10), max_loss=0.99)
    assert len(out.factor_data_clean) > 0
    assert len(out.quantized) > 0
    assert out.factor_frame.shape[1] >= 1
    assert len(out.metrics.ic) > 0
    assert not out.metrics.ic_summary.empty
    assert not out.metrics.mean_return_by_quantile.empty
