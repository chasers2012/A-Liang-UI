"""
Alphalens-based factor evaluation (Factor + DependencyResolver, no database).

Uses **alphalens-reloaded** (PyPI: ``alphalens-reloaded``); import name remains ``alphalens``.

Aligned with trade-backend ``FactorEvaluator`` flows: clean factor + forward returns,
IC / quantile metrics via Alphalens ``performance``.
"""

from __future__ import annotations

import contextlib
from dataclasses import dataclass
from typing import Any

import alphalens as al
import pandas as pd
from factor.factor import Factor

from .alphalens_ic_metric import (
    FactorInformationCoefficientMetric,
    MeanInformationCoefficientMetric,
)
from .evaluation_metric import EvaluationMetric


def close_prices_wide(price_panel: pd.DataFrame, close_col: str = "close") -> pd.DataFrame:
    """
    Unstack MultiIndex (date, asset) panel to Alphalens price format: index = date, columns = asset.
    """
    if close_col not in price_panel.columns:
        raise KeyError(f"price_panel must contain column {close_col!r}")
    close_df = price_panel[close_col].unstack(level="asset")
    close_df.columns.name = None
    if not isinstance(close_df.index, pd.DatetimeIndex):
        with contextlib.suppress(TypeError, ValueError):
            close_df.index = pd.to_datetime(close_df.index)
    return close_df


def compute_forward_return_from_wide(close_df: pd.DataFrame, period: int) -> pd.Series:
    """Wide close (date × asset) -> forward return Series with MultiIndex (date, asset)."""
    fwd_ret = close_df.pct_change(period).shift(-period)
    fwd_ret = fwd_ret.stack()
    fwd_ret.index.names = ["date", "asset"]
    return fwd_ret


@dataclass
class AlphalensMetrics:
    """
    Alphalens ``performance`` outputs for one evaluation (IC, quantile returns, spread, etc.).
    """

    ic: pd.DataFrame
    ic_summary: pd.DataFrame
    mean_ic: pd.Series
    mean_return_by_quantile: pd.DataFrame
    mean_return_by_quantile_std_error: pd.DataFrame
    mean_return_spread: pd.Series
    mean_return_spread_std_error: pd.Series | None
    factor_alpha_beta: pd.DataFrame
    factor_rank_autocorrelation: pd.Series


def _mean_returns_spread(
    mean_ret: pd.DataFrame,
    std_err: pd.DataFrame,
    upper_quantile: int,
    lower_quantile: int,
) -> tuple[pd.Series, pd.Series | None]:
    """
    Top-quantile minus bottom-quantile mean forward returns per horizon.

    ``alphalens.performance.compute_mean_returns_spread`` expects a MultiIndex
    from ``mean_return_by_quantile(..., by_date=True)``; pooled
    ``by_date=False`` output uses a flat ``factor_quantile`` index, so we branch.
    """
    if isinstance(mean_ret.index, pd.MultiIndex):
        return al.performance.compute_mean_returns_spread(
            mean_ret, upper_quantile, lower_quantile, std_err=std_err
        )
    hi = mean_ret.loc[upper_quantile]
    lo = mean_ret.loc[lower_quantile]
    spread = hi - lo
    if std_err is None or std_err.empty:
        return spread, None
    se_hi = std_err.loc[upper_quantile]
    se_lo = std_err.loc[lower_quantile]
    spread_se = (se_hi**2 + se_lo**2) ** 0.5
    return spread, spread_se


def _alphalens_metrics(
    factor_data_clean: pd.DataFrame,
    *,
    quantiles: int,
    group_adjust: bool = False,
    quantile_returns_demeaned: bool = True,
) -> AlphalensMetrics:
    ic = FactorInformationCoefficientMetric().evaluate(factor_data_clean)
    ic_summary = ic.describe()
    mean_ic = MeanInformationCoefficientMetric().evaluate(factor_data_clean)
    mean_ret, std_err = al.performance.mean_return_by_quantile(
        factor_data_clean,
        by_date=False,
        by_group=False,
        demeaned=quantile_returns_demeaned,
        group_adjust=group_adjust,
    )
    spread, spread_se = _mean_returns_spread(mean_ret, std_err, quantiles, 1)
    alpha_beta = al.performance.factor_alpha_beta(
        factor_data_clean,
        demeaned=quantile_returns_demeaned,
        group_adjust=group_adjust,
        equal_weight=False,
    )
    rank_ac = al.performance.factor_rank_autocorrelation(factor_data_clean, period=1)
    return AlphalensMetrics(
        ic=ic,
        ic_summary=ic_summary,
        mean_ic=mean_ic,
        mean_return_by_quantile=mean_ret,
        mean_return_by_quantile_std_error=std_err,
        mean_return_spread=spread,
        mean_return_spread_std_error=spread_se,
        factor_alpha_beta=alpha_beta,
        factor_rank_autocorrelation=rank_ac,
    )


class MeanReturnSpreadMetric(EvaluationMetric[pd.Series]):
    """Mean long-short quantile spread per period (AlphalensMetrics.mean_return_spread)."""

    def evaluate(
        self,
        factor_data_clean: pd.DataFrame,
        *,
        quantiles: int,
        **kwargs: Any,
    ) -> pd.Series:
        return _alphalens_metrics(
            factor_data_clean,
            quantiles=quantiles,
            group_adjust=False,
            quantile_returns_demeaned=True,
        ).mean_return_spread


@dataclass
class AlphalensEvaluateResult:
    factor_data_clean: pd.DataFrame
    quantized: pd.DataFrame
    factor_frame: pd.DataFrame
    metrics: AlphalensMetrics

    @property
    def factor_data(self) -> pd.DataFrame:
        """Alias for ``factor_frame`` (raw factor column(s) from :meth:`Factor.calculate`)."""
        return self.factor_frame


class AlphalensFactorEvaluator:
    """
    Factor evaluation using Alphalens (``alphalens-reloaded`` distribution).

    Pass a :class:`~factor.factor.Factor` with ``dependency_resolver`` set. The evaluator
    loads the price panel (for forward returns) via the resolver and runs
    :meth:`~factor.factor.Factor.calculate` for Alphalens inputs.
    """

    def __init__(
        self,
        factor: Factor,
        *,
        start_date: str | None,
        end_date: str,
        instrument_codes: list[str] | None = None,
        long_short: bool = True,
        close_col: str = "close",
    ) -> None:
        if factor._dependency_resolver is None:
            raise ValueError("factor must have dependency_resolver set on the instance")

        self.factor = factor
        self._start_date = start_date
        self._end_date = end_date
        self._instrument_codes = instrument_codes
        self.long_short = long_short
        self.close_col = close_col
        self._close_wide: pd.DataFrame | None = None

        fields = list(dict.fromkeys(list(factor.dependencies)))
        if close_col not in fields:
            fields.append(close_col)
        self._price_panel = factor._dependency_resolver.get_panel(
            fields=fields,
            start_date=start_date,
            end_date=end_date,
            instrument_codes=instrument_codes,
            window=factor.max_window,
        )
        if self._price_panel.empty:
            raise ValueError("Price panel is empty for the given range and resolver")
        if close_col not in self._price_panel.columns:
            raise KeyError(
                f"close_col {close_col!r} missing from loaded panel columns "
                f"{list(self._price_panel.columns)}"
            )

    def alignment_index(self) -> pd.Index:
        return self._price_panel.index

    def get_close_wide(self) -> pd.DataFrame:
        if self._close_wide is None:
            self._close_wide = close_prices_wide(self._price_panel, self.close_col)
        return self._close_wide

    def prepare_factor_data(
        self,
        quantiles: int | tuple[float, ...] = 5,
        periods: tuple[int, ...] = (1, 5, 10, 20),
        max_loss: float = 0.5,
        *,
        groupby: Any | None = None,
        binning_by_group: bool = False,
        bins: Any | None = None,
        filter_zscore: int | float = 20,
        groupby_labels: Any | None = None,
        zero_aware: bool = False,
        cumulative_returns: bool = True,
    ) -> pd.DataFrame:
        factor_data = self.factor.calculate(
            self._start_date,
            self._end_date,
            self._instrument_codes,
        )
        if not isinstance(factor_data.index, pd.MultiIndex):
            raise ValueError("factor.calculate must return MultiIndex (date, asset)")
        if factor_data.shape[1] < 1:
            raise ValueError("factor.calculate must return at least one column")

        factor_series = factor_data.iloc[:, 0].dropna()
        close_df = self.get_close_wide()
        align_idx = self.alignment_index()
        factor_series = factor_series[factor_series.index.isin(align_idx)]

        return al.utils.get_clean_factor_and_forward_returns(
            factor=factor_series,
            prices=close_df,
            groupby=groupby,
            binning_by_group=binning_by_group,
            quantiles=quantiles,
            bins=bins,
            periods=periods,
            filter_zscore=filter_zscore,
            groupby_labels=groupby_labels,
            max_loss=max_loss,
            zero_aware=zero_aware,
            cumulative_returns=cumulative_returns,
        )

    def evaluate_factor(
        self,
        *,
        quantiles: int = 5,
        periods: tuple[int, ...] = (1, 5, 10, 20),
        max_loss: float = 0.5,
        groupby: Any | None = None,
        binning_by_group: bool = False,
        bins: Any | None = None,
        filter_zscore: int | float = 20,
        groupby_labels: Any | None = None,
        zero_aware: bool = False,
        cumulative_returns: bool = True,
        group_adjust: bool = False,
        quantile_returns_demeaned: bool = True,
    ) -> AlphalensEvaluateResult:
        factor_data = self.factor.calculate(
            self._start_date,
            self._end_date,
            self._instrument_codes,
        )
        if not isinstance(factor_data.index, pd.MultiIndex):
            raise ValueError("factor.calculate must return MultiIndex (date, asset)")
        if factor_data.shape[1] < 1:
            raise ValueError("factor.calculate must return at least one column")

        factor_series = factor_data.iloc[:, 0].dropna()
        close_df = self.get_close_wide()
        align_idx = self.alignment_index()
        factor_series = factor_series[factor_series.index.isin(align_idx)]

        factor_data_clean = al.utils.get_clean_factor_and_forward_returns(
            factor=factor_series,
            prices=close_df,
            groupby=groupby,
            binning_by_group=binning_by_group,
            quantiles=quantiles,
            bins=bins,
            periods=periods,
            filter_zscore=filter_zscore,
            groupby_labels=groupby_labels,
            max_loss=max_loss,
            zero_aware=zero_aware,
            cumulative_returns=cumulative_returns,
        )

        quantized = al.utils.quantize_factor(factor_data_clean, quantiles)
        metrics = _alphalens_metrics(
            factor_data_clean,
            quantiles=quantiles,
            group_adjust=group_adjust,
            quantile_returns_demeaned=quantile_returns_demeaned,
        )
        return AlphalensEvaluateResult(
            factor_data_clean=factor_data_clean,
            quantized=quantized,
            factor_frame=factor_data,
            metrics=metrics,
        )
