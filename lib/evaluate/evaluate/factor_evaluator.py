"""
Alphalens-based factor evaluation (panel / wide prices in, no database).

Uses **alphalens-reloaded** (PyPI: ``alphalens-reloaded``); import name remains ``alphalens``.

Aligned with trade-backend ``FactorEvaluator`` flows: clean factor + forward returns,
optional tear sheets, risk-style CS regression, IC weighting, and factor transforms.
"""
from __future__ import annotations

import contextlib
import os
from dataclasses import dataclass
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple

import alphalens as al
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from alphalens.tears import create_full_tear_sheet


def close_prices_wide(price_panel: pd.DataFrame, close_col: str = "close") -> pd.DataFrame:
    """
    Unstack MultiIndex (date, asset) panel to Alphalens price format: index = date, columns = asset.
    """
    if close_col not in price_panel.columns:
        raise KeyError(f"price_panel must contain column {close_col!r}")
    close_df = price_panel[close_col].unstack(level="asset")
    close_df.columns.name = None
    if not isinstance(close_df.index, pd.DatetimeIndex):
        try:
            close_df.index = pd.to_datetime(close_df.index)
        except (TypeError, ValueError):
            pass
    return close_df


def compute_forward_return_from_wide(close_df: pd.DataFrame, period: int) -> pd.Series:
    """Wide close (date × asset) -> forward return Series with MultiIndex (date, asset)."""
    fwd_ret = close_df.pct_change(period).shift(-period)
    fwd_ret = fwd_ret.stack()
    fwd_ret.index.names = ["date", "asset"]
    return fwd_ret


@contextlib.contextmanager
def save_tear_sheet_figures(save_dir: str) -> Iterator[None]:
    """Redirect ``plt.show`` to save figures under ``save_dir`` (like trade-backend evaluator)."""
    os.makedirs(save_dir, exist_ok=True)
    original_show = plt.show
    figures_to_save: list[Any] = []

    def _save_instead() -> None:
        fig = plt.gcf()
        if fig is not None and len(fig.get_axes()) > 0:
            figures_to_save.append(fig)

    plt.show = _save_instead  # type: ignore[assignment]
    try:
        yield
    finally:
        plt.show = original_show  # type: ignore[assignment]
        for i, fig in enumerate(figures_to_save):
            if fig is not None:
                path = os.path.join(save_dir, f"tear_sheet_{i + 1}.png")
                fig.savefig(path, dpi=150, bbox_inches="tight")
                plt.close(fig)


def print_quantile_stats(factor_data_clean: pd.DataFrame, periods: Sequence[int], q: int) -> None:
    """Print win rate / PnL-style stats for one quantile bucket (debug helper)."""
    df = factor_data_clean[factor_data_clean["factor_quantile"] == q]
    for period in periods:
        label = f"{period}D"
        win_rate = (df[label] > 0).mean()
        profit = df.loc[df[label] > 0, label].mean()
        loss = -df.loc[df[label] < 0, label].mean()
        skew = df[label].skew()
        kurt = df[label].kurt()
        median = df[label].median()
        profit_loss_ratio = profit / loss if loss and not np.isnan(loss) else np.nan
        print(
            f"多头分位{q}的{label}胜率: {win_rate}, 盈亏比: {profit_loss_ratio}, "
            f"平均收益: {profit}, 平均亏损: {loss}, 偏度: {skew}, 峰度: {kurt}, 中位数: {median}"
        )


@dataclass
class AlphalensEvaluateResult:
    factor_data_clean: pd.DataFrame
    quantized: pd.DataFrame


class AlphalensFactorEvaluator:
    """
    Factor evaluation using Alphalens (``alphalens-reloaded`` distribution).

    Pass a **full** price panel for ``close_prices_wide`` (forward returns need full paths).
    Optionally pass a **filtered** panel (subset of rows) so factor observations align to
    tradable points only—same idea as ``get_filtered_price_data`` in trade-backend.
    """

    def __init__(
        self,
        price_panel: pd.DataFrame,
        *,
        filtered_panel: Optional[pd.DataFrame] = None,
        long_short: bool = True,
        close_col: str = "close",
    ) -> None:
        self.price_panel = price_panel
        self.filtered_panel = filtered_panel
        self.long_short = long_short
        self.close_col = close_col
        self._close_wide: Optional[pd.DataFrame] = None

    def alignment_index(self) -> pd.Index:
        panel = self.filtered_panel if self.filtered_panel is not None else self.price_panel
        return panel.index

    def get_close_wide(self) -> pd.DataFrame:
        if self._close_wide is None:
            self._close_wide = close_prices_wide(self.price_panel, self.close_col)
        return self._close_wide

    def evaluate_factor(
        self,
        factor_data: pd.DataFrame,
        *,
        quantiles: int = 5,
        periods: Tuple[int, ...] = (1, 5, 10, 20),
        max_loss: float = 0.5,
        tear_sheet_dir: Optional[str] = None,
        dump_quantile_stats: bool = False,
        long_short: Optional[bool] = None,
    ) -> AlphalensEvaluateResult:
        if not isinstance(factor_data.index, pd.MultiIndex):
            raise ValueError("factor_data must use MultiIndex (date, asset)")
        if factor_data.shape[1] < 1:
            raise ValueError("factor_data must have at least one column")

        name = factor_data.columns[0]
        factor_series = factor_data.iloc[:, 0].dropna()
        close_df = self.get_close_wide()
        align_idx = self.alignment_index()
        factor_series = factor_series[factor_series.index.isin(align_idx)]

        factor_data_clean = al.utils.get_clean_factor_and_forward_returns(
            factor=factor_series,
            prices=close_df,
            quantiles=quantiles,
            periods=periods,
            max_loss=max_loss,
        )
        ls = self.long_short if long_short is None else long_short

        if tear_sheet_dir is not None:
            with save_tear_sheet_figures(tear_sheet_dir):
                if dump_quantile_stats:
                    print_quantile_stats(factor_data_clean, periods, quantiles)
                    print_quantile_stats(factor_data_clean, periods, 1)
                create_full_tear_sheet(factor_data_clean, long_short=ls)
        elif dump_quantile_stats:
            print_quantile_stats(factor_data_clean, periods, quantiles)
            print_quantile_stats(factor_data_clean, periods, 1)

        quantized = al.utils.quantize_factor(factor_data_clean, quantiles)
        _ = name  # reserved for logging extensions
        return AlphalensEvaluateResult(factor_data_clean=factor_data_clean, quantized=quantized)

    def evaluate_risk_factor(
        self,
        factor_data: pd.DataFrame,
        periods: Tuple[int, ...] = (1, 5, 10, 20),
    ) -> Dict[str, Any]:
        import statsmodels.api as sm
        from scipy.stats import kurtosis, skew

        if not isinstance(factor_data.index, pd.MultiIndex):
            raise ValueError("factor_data must use MultiIndex (date, asset)")

        name = factor_data.columns[0]
        factor = factor_data.iloc[:, 0].dropna()
        close_df = self.get_close_wide()
        align_idx = self.alignment_index()
        factor = factor[factor.index.isin(align_idx)]

        results: Dict[str, Any] = {}

        def zscore_cs(x: pd.Series) -> pd.Series:
            std = x.std()
            if std == 0 or np.isnan(std):
                return x * np.nan
            return (x - x.mean()) / std

        factor_z = factor.groupby(level="date", group_keys=False).transform(zscore_cs)

        dist_stats = factor_z.groupby(level="date").agg(
            mean="mean",
            std="std",
            skew=lambda x: skew(x, nan_policy="omit"),
            kurt=lambda x: kurtosis(x, nan_policy="omit"),
        )
        results["distribution"] = dist_stats.describe()
        results["factor_name"] = name

        for period in periods:
            fwd_ret = compute_forward_return_from_wide(close_df, period)
            df = pd.concat([factor_z.rename("factor"), fwd_ret.rename("ret")], axis=1).dropna()

            def cs_reg(frame: pd.DataFrame) -> pd.Series:
                y = frame["ret"]
                X = sm.add_constant(frame["factor"])
                res = sm.OLS(y, X).fit()
                return pd.Series([res.params["factor"], res.rsquared], index=["beta", "r2"])

            reg_res = df.groupby(level="date").apply(lambda x: cs_reg(x))
            beta_ts = reg_res["beta"]
            r2_ts = reg_res["r2"]
            results[f"{period}D"] = {
                "beta_mean": beta_ts.mean(),
                "beta_std": beta_ts.std(),
                "beta_same_sign_ratio": (np.sign(beta_ts) == np.sign(beta_ts.mean())).mean(),
                "r2_mean": r2_ts.mean(),
            }

        stable_beta = all(results[f"{p}D"]["beta_same_sign_ratio"] > 0.7 for p in periods)
        explain_power = float(np.mean([results[f"{p}D"]["r2_mean"] for p in periods]))
        results["is_risk_factor"] = bool(stable_beta and explain_power > 0.01)
        results["explain_power_r2_mean"] = explain_power
        return results

    def balance_factors(
        self,
        factor_datas: List[pd.DataFrame],
        quantiles: int = 5,
        periods: Tuple[int, ...] = (1, 5, 10, 20),
        weights: Optional[Sequence[float]] = None,
    ) -> Tuple[pd.DataFrame, np.ndarray]:
        close_df = self.get_close_wide()
        if not weights:
            scores: list[float] = []
            for factor in factor_datas:
                factor_series = factor.iloc[:, 0].dropna()
                factor_data_clean = al.utils.get_clean_factor_and_forward_returns(
                    factor=factor_series,
                    prices=close_df,
                    quantiles=quantiles,
                    periods=periods,
                )
                ic = al.performance.factor_information_coefficient(
                    factor_data_clean, group_adjust=False, by_group=False
                )
                # Use longest horizon (last forward-return column), same intent as trade-backend ``20D``.
                ir = float(ic.mean().iloc[-1])
                scores.append(ir)
            arr = np.array(scores, dtype=float)
            weights_arr = arr / np.abs(arr).sum()
        else:
            weights_arr = np.array(list(weights), dtype=float)
            weights_arr = weights_arr / np.abs(weights_arr).sum()

        merged = pd.DataFrame(index=factor_datas[0].index)
        for i, factor in enumerate(factor_datas):
            merged[i] = weights_arr[i] * factor.iloc[:, 0]
        merged["result"] = merged[list(range(len(factor_datas)))].sum(axis=1)
        return pd.DataFrame(merged["result"]), weights_arr

    def build_ic_weighted_from_frames(
        self,
        factor_frames: List[pd.DataFrame],
        periods: Tuple[int, ...] = (10,),
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """IC-weighted combo from precomputed factor columns (MultiIndex date, asset)."""
        close_df = self.get_close_wide()
        ic_raw_df = pd.DataFrame()
        ic_smooth_df = pd.DataFrame()
        factors = pd.DataFrame()

        def estimate_half_life_past(ic_series: pd.Series, max_lag: int = 30, min_len: int = 15) -> float:
            if len(ic_series) < min_len:
                return float(periods[0])
            acfs: list[float] = []
            for lag in range(1, max_lag + 1):
                ac = ic_series.autocorr(lag)
                if ac is None or np.isnan(ac) or ac <= 0:
                    break
                acfs.append(float(ac))
            if len(acfs) < 2:
                return float(periods[0])
            acfs_a = np.array(acfs)
            lags = np.arange(1, len(acfs_a) + 1)
            try:
                slope = np.polyfit(lags, np.log(acfs_a), 1)[0]
                hl = np.log(0.5) / slope
                return float(np.clip(hl, 2, max_lag))
            except Exception:
                return float(periods[0])

        for factor_df in factor_frames:
            name = factor_df.columns[0]
            factor_series = factor_df.iloc[:, 0].dropna()
            factor_al = al.utils.get_clean_factor_and_forward_returns(
                factor=factor_series,
                prices=close_df,
                periods=periods,
                quantiles=10,
            )
            factors[name] = factor_series
            ic = al.performance.factor_information_coefficient(factor_al)
            ic_raw_df[name] = ic.iloc[:, 0]

        for name in ic_raw_df.columns:
            ic_series = ic_raw_df[name]
            smoothed: list[float] = []
            for t in range(len(ic_series)):
                past_ic = ic_series.iloc[: t + 1].dropna()
                hl = estimate_half_life_past(past_ic)
                if len(past_ic) < 3:
                    smoothed.append(np.nan)
                else:
                    smoothed.append(
                        float(
                            past_ic.ewm(
                                halflife=hl,
                                min_periods=max(3, int(hl // 2)),
                                adjust=False,
                            )
                            .mean()
                            .iloc[-1]
                        )
                    )
            ic_smooth_df[name] = pd.Series(smoothed, index=ic_series.index)

        denom = ic_smooth_df.abs().sum(axis=1).replace(0, np.nan)
        weights = ic_smooth_df.div(denom, axis=0).shift(periods[0])

        combined: list[pd.Series] = []
        for name in factors.columns:
            combined.append(factors[name] * weights[name])
        combined_factor_df = pd.concat(combined, axis=1).sum(axis=1).to_frame("combined_factor")
        return combined_factor_df, weights, ic_raw_df

    def orthogonalize_factor_list(
        self,
        factor_list: List[pd.DataFrame],
        min_obs: int = 10,
        fillna: Optional[float] = 0.0,
    ) -> List[pd.DataFrame]:
        factor_df = pd.concat(factor_list, axis=1)
        if not isinstance(factor_df.index, pd.MultiIndex):
            raise ValueError("Index must be MultiIndex (date, asset)")
        if fillna is not None:
            factor_df = factor_df.fillna(fillna)
        factor_names = list(factor_df.columns)

        def _orth_one_day(x: pd.DataFrame) -> pd.DataFrame:
            if len(x) < max(min_obs, len(factor_names) + 1):
                return x
            result = pd.DataFrame(index=x.index)
            for f in factor_names:
                y = x[f].values
                if result.empty:
                    result[f] = y
                else:
                    X = result.values
                    beta = np.linalg.lstsq(X, y, rcond=None)[0]
                    y_orth = y - X @ beta
                    result[f] = y_orth
            return result

        orth_df = factor_df.groupby(level="date", group_keys=False).apply(_orth_one_day).sort_index()
        return [orth_df[[name]] for name in factor_names]

    def extract_factor_pca_auto(
        self,
        factor_list: List[pd.DataFrame],
        min_obs: int = 20,
        fillna: Optional[float] = 0.0,
        clip: Optional[float] = 5.0,
        var_threshold: float = 0.7,
        max_components: Optional[int] = None,
    ) -> pd.DataFrame:
        factor_df = pd.concat([df.iloc[:, 0] for df in factor_list], axis=1)
        if fillna is not None:
            factor_df = factor_df.fillna(fillna)
        k = factor_df.shape[1]

        def _pca_one_day(x: pd.DataFrame) -> pd.DataFrame:
            if len(x) < max(min_obs, k + 1):
                return pd.DataFrame(index=x.index)
            X = x.values.astype(float)
            if clip is not None:
                X = np.clip(X, -clip, clip)
            X = X - X.mean(axis=0, keepdims=True)
            if np.allclose(X, 0):
                return pd.DataFrame(index=x.index)
            try:
                u, s, _vt = np.linalg.svd(X, full_matrices=False)
            except Exception:
                return pd.DataFrame(index=x.index)
            var_ratio = (s**2) / np.sum(s**2)
            cum_var = np.cumsum(var_ratio)
            n_comp = int(np.searchsorted(cum_var, var_threshold) + 1)
            if max_components is not None:
                n_comp = min(n_comp, max_components)
            pcs = u[:, :n_comp] * s[:n_comp]
            cols = [f"PC{i + 1}" for i in range(n_comp)]
            return pd.DataFrame(pcs, index=x.index, columns=cols)

        return factor_df.groupby(level="date", group_keys=False).apply(_pca_one_day).sort_index()

    def extract_factor_pca_alpha(
        self,
        factor_list: List[pd.DataFrame],
        min_obs: int = 20,
        fillna: Optional[float] = 0.0,
        clip: Optional[float] = 5.0,
        var_threshold: float = 0.5,
        max_components: Optional[int] = 2,
    ) -> pd.DataFrame:
        import scipy.stats

        factor_df = pd.concat([df.iloc[:, 0] for df in factor_list], axis=1)
        if fillna is not None:
            factor_df = factor_df.fillna(fillna)
        k = factor_df.shape[1]

        def _pca_one_day(x: pd.DataFrame) -> pd.Series:
            if len(x) < max(min_obs, k + 1):
                return pd.Series(index=x.index, dtype=float)
            X = x.to_numpy(dtype=float)
            if clip is not None:
                X = np.clip(X, -clip, clip)
            x_df = pd.DataFrame(X, index=x.index)
            x_df = x_df.rank(pct=True).clip(1e-6, 1 - 1e-6)
            X = scipy.stats.norm.ppf(x_df.to_numpy())
            X = X - X.mean(axis=0, keepdims=True)
            if np.allclose(X, 0):
                return pd.Series(index=x.index, dtype=float)
            try:
                u, s, _vt = np.linalg.svd(X, full_matrices=False)
            except Exception:
                return pd.Series(index=x.index, dtype=float)
            var_ratio = (s**2) / np.sum(s**2)
            cum_var = np.cumsum(var_ratio)
            n_comp = int(np.searchsorted(cum_var, var_threshold) + 1)
            if max_components is not None:
                n_comp = min(n_comp, max_components)
            pcs = u[:, :n_comp] * s[:n_comp]
            w = s[:n_comp] / s[:n_comp].sum()
            factor = (pcs * w).sum(axis=1)
            return pd.Series(factor, index=x.index).rank(pct=True)

        factor = factor_df.groupby(level="date", group_keys=False).apply(_pca_one_day).sort_index()
        return factor.to_frame(name="pca_alpha")

    def extract_factor_pca_max_dist(
        self,
        factor_list: List[pd.DataFrame],
        min_obs: int = 20,
        fillna: Optional[float] = 0.0,
        clip: Optional[float] = 5.0,
        var_threshold: float = 0.5,
        max_components: Optional[int] = 2,
    ) -> pd.DataFrame:
        import scipy.stats

        factor_df = pd.concat([df.iloc[:, 0] for df in factor_list], axis=1)
        if fillna is not None:
            factor_df = factor_df.fillna(fillna)
        k = factor_df.shape[1]

        def _pca_one_day(x: pd.DataFrame) -> pd.Series:
            if len(x) < max(min_obs, k + 1):
                return pd.Series(index=x.index, dtype=float)
            X = x.to_numpy(dtype=float)
            if clip is not None:
                X = np.clip(X, -clip, clip)
            x_df = pd.DataFrame(X, index=x.index)
            x_df = x_df.rank(pct=True).clip(1e-6, 1 - 1e-6)
            X = scipy.stats.norm.ppf(x_df.to_numpy())
            X = X - X.mean(axis=0, keepdims=True)
            if np.allclose(X, 0):
                return pd.Series(index=x.index, dtype=float)
            try:
                u, s, _vt = np.linalg.svd(X, full_matrices=False)
            except Exception:
                return pd.Series(index=x.index, dtype=float)
            var_ratio = (s**2) / np.sum(s**2)
            cum_var = np.cumsum(var_ratio)
            n_comp = int(np.searchsorted(cum_var, var_threshold) + 1)
            if max_components is not None:
                n_comp = min(n_comp, max_components)
            pcs = u[:, :n_comp] * s[:n_comp]
            w = s[:n_comp] / s[:n_comp].sum()
            factor = (pcs * w).sum(axis=1)
            return pd.Series(factor, index=x.index)

        factor = factor_df.groupby(level="date", group_keys=False).apply(_pca_one_day).sort_index()
        return factor.to_frame(name="pca_max_dist")

    def project_factor_list_unsupervised(
        self,
        factor_list: List[pd.DataFrame],
        min_obs: int = 30,
        normalize_weight: bool = True,
        clip: float = 5.0,
    ) -> List[pd.DataFrame]:
        factor_names = [df.columns[0] for df in factor_list]
        factor_df = pd.concat([df.iloc[:, 0] for df in factor_list], axis=1)
        factor_df.columns = factor_names

        def _project_one_day(x: pd.DataFrame) -> pd.DataFrame:
            if len(x) < max(min_obs, len(factor_names) * 2):
                return x
            X = x.values.astype(float)
            if clip is not None:
                X = np.clip(X, -clip, clip)
            X = X - np.nanmean(X, axis=0, keepdims=True)
            if np.allclose(X, 0):
                return x
            try:
                _u, _s, vt = np.linalg.svd(X, full_matrices=False)
                w = vt[0]
            except Exception:
                return x
            if np.nansum(w) < 0:
                w = -w
            if normalize_weight:
                s_abs = np.nansum(np.abs(w))
                if s_abs:
                    w = w / s_abs
            return pd.DataFrame(X * w, index=x.index, columns=x.columns)

        projected_df = factor_df.groupby(level="date", group_keys=False).apply(_project_one_day).sort_index()
        return [projected_df[[name]] for name in factor_names]
