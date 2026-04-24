from __future__ import annotations

import pandas as pd
import vectorbt as vbt
from factor import Factor


class Ma20Factor(Factor):
    name = "ma_20"
    group = "technical"
    description = "20日移动平均（MA）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MA.run(close, window=int(self.params["window"]), ewm=False).ma


class Ema20Factor(Factor):
    name = "ema_20"
    group = "technical"
    description = "20日指数移动平均（EMA）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MA.run(close, window=int(self.params["window"]), ewm=True).ma


class Mstd20Factor(Factor):
    name = "mstd_20"
    group = "technical"
    description = "20日移动标准差（MSTD）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MSTD.run(close, window=int(self.params["window"]), ewm=False).mstd


class BbandsMiddle20Factor(Factor):
    name = "bbands_middle_20"
    group = "technical"
    description = "20日布林带中轨（BBANDS middle）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=int(self.params["window"])).middle


class BbandsUpper20Factor(Factor):
    name = "bbands_upper_20"
    group = "technical"
    description = "20日布林带上轨（BBANDS upper）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=int(self.params["window"])).upper


class BbandsLower20Factor(Factor):
    name = "bbands_lower_20"
    group = "technical"
    description = "20日布林带下轨（BBANDS lower）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=int(self.params["window"])).lower


class Rsi14Factor(Factor):
    name = "rsi_14"
    group = "technical"
    description = "14日相对强弱指标（RSI）"
    param_specs = ({"name": "window", "label": "窗口", "default": 14, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.RSI.run(close, window=int(self.params["window"])).rsi


class StochPercentK143Factor(Factor):
    name = "stoch_k_14_3"
    group = "technical"
    description = "随机指标K线（STOCH %K, 14/3）"
    k_window = 14
    d_window = 3
    param_specs = (
        {"name": "k_window", "label": "K窗口", "default": 14, "min": 1, "max": 250},
        {"name": "d_window", "label": "D窗口", "default": 3, "min": 1, "max": 250},
    )

    @property
    def window(self) -> int:
        return int(max(self.params["k_window"], self.params["d_window"]))

    def calc(self, high: pd.DataFrame, low: pd.DataFrame, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.STOCH.run(
            high,
            low,
            close,
            k_window=int(self.params["k_window"]),
            d_window=int(self.params["d_window"]),
        ).percent_k


class StochPercentD143Factor(Factor):
    name = "stoch_d_14_3"
    group = "technical"
    description = "随机指标D线（STOCH %D, 14/3）"
    k_window = 14
    d_window = 3
    param_specs = (
        {"name": "k_window", "label": "K窗口", "default": 14, "min": 1, "max": 250},
        {"name": "d_window", "label": "D窗口", "default": 3, "min": 1, "max": 250},
    )

    @property
    def window(self) -> int:
        return int(max(self.params["k_window"], self.params["d_window"]))

    def calc(self, high: pd.DataFrame, low: pd.DataFrame, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.STOCH.run(
            high,
            low,
            close,
            k_window=int(self.params["k_window"]),
            d_window=int(self.params["d_window"]),
        ).percent_d


class Macd12269Factor(Factor):
    name = "macd_12_26_9"
    group = "technical"
    description = "MACD主线（12,26,9）"
    fast_window = 12
    slow_window = 26
    signal_window = 9
    param_specs = (
        {"name": "fast_window", "label": "快线窗口", "default": 12, "min": 1, "max": 250},
        {"name": "slow_window", "label": "慢线窗口", "default": 26, "min": 1, "max": 250},
        {"name": "signal_window", "label": "信号窗口", "default": 9, "min": 1, "max": 250},
    )

    @property
    def window(self) -> int:
        return int(
            max(
                self.params["fast_window"], self.params["slow_window"], self.params["signal_window"]
            )
        )

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MACD.run(
            close,
            fast_window=int(self.params["fast_window"]),
            slow_window=int(self.params["slow_window"]),
            signal_window=int(self.params["signal_window"]),
        ).macd


class MacdSignal12269Factor(Factor):
    name = "macd_signal_12_26_9"
    group = "technical"
    description = "MACD信号线（12,26,9）"
    fast_window = 12
    slow_window = 26
    signal_window = 9
    param_specs = (
        {"name": "fast_window", "label": "快线窗口", "default": 12, "min": 1, "max": 250},
        {"name": "slow_window", "label": "慢线窗口", "default": 26, "min": 1, "max": 250},
        {"name": "signal_window", "label": "信号窗口", "default": 9, "min": 1, "max": 250},
    )

    @property
    def window(self) -> int:
        return int(
            max(
                self.params["fast_window"], self.params["slow_window"], self.params["signal_window"]
            )
        )

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MACD.run(
            close,
            fast_window=int(self.params["fast_window"]),
            slow_window=int(self.params["slow_window"]),
            signal_window=int(self.params["signal_window"]),
        ).signal


class MacdHist12269Factor(Factor):
    name = "macd_hist_12_26_9"
    group = "technical"
    description = "MACD柱（12,26,9）"
    fast_window = 12
    slow_window = 26
    signal_window = 9
    param_specs = (
        {"name": "fast_window", "label": "快线窗口", "default": 12, "min": 1, "max": 250},
        {"name": "slow_window", "label": "慢线窗口", "default": 26, "min": 1, "max": 250},
        {"name": "signal_window", "label": "信号窗口", "default": 9, "min": 1, "max": 250},
    )

    @property
    def window(self) -> int:
        return int(
            max(
                self.params["fast_window"], self.params["slow_window"], self.params["signal_window"]
            )
        )

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MACD.run(
            close,
            fast_window=int(self.params["fast_window"]),
            slow_window=int(self.params["slow_window"]),
            signal_window=int(self.params["signal_window"]),
        ).hist


class Atr14Factor(Factor):
    name = "atr_14"
    group = "technical"
    description = "14日平均真实波动幅度（ATR）"
    param_specs = ({"name": "window", "label": "窗口", "default": 14, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, high: pd.DataFrame, low: pd.DataFrame, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.ATR.run(high, low, close, window=int(self.params["window"])).atr


class ObvFactor(Factor):
    name = "obv"
    group = "technical"
    description = "能量潮指标（OBV）"

    @property
    def window(self) -> int:
        return 1

    def calc(self, close: pd.DataFrame, volume: pd.DataFrame) -> pd.DataFrame:
        return vbt.OBV.run(close, volume).obv
