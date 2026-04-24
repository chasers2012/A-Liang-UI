from __future__ import annotations

import pandas as pd
import vectorbt as vbt
from factor import Factor


class MaFactor(Factor):
    name = "移动平均"
    group = "technical"
    description = "移动平均（MA）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MA.run(close, window=int(self.params["window"]), ewm=False).ma


class EmaFactor(Factor):
    name = "指数移动平均"
    group = "technical"
    description = "指数移动平均（EMA）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MA.run(close, window=int(self.params["window"]), ewm=True).ma


class MstdFactor(Factor):
    name = "移动标准差"
    group = "technical"
    description = "移动标准差（MSTD）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MSTD.run(close, window=int(self.params["window"]), ewm=False).mstd


class BbandsMiddleFactor(Factor):
    name = "布林带中轨"
    group = "technical"
    description = "布林带中轨（BBANDS middle）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=int(self.params["window"])).middle


class BbandsUpperFactor(Factor):
    name = "布林带上轨"
    group = "technical"
    description = "布林带上轨（BBANDS upper）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=int(self.params["window"])).upper


class BbandsLowerFactor(Factor):
    name = "布林带下轨"
    group = "technical"
    description = "布林带下轨（BBANDS lower）"
    param_specs = ({"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=int(self.params["window"])).lower


class RsiFactor(Factor):
    name = "相对强弱指标"
    group = "technical"
    description = "相对强弱指标（RSI）"
    param_specs = ({"name": "window", "label": "窗口", "default": 14, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.RSI.run(close, window=int(self.params["window"])).rsi


class StochPercentKFactor(Factor):
    name = "随机指标K线"
    group = "technical"
    description = "随机指标K线（STOCH %K）"
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


class StochPercentDFactor(Factor):
    name = "随机指标D线"
    group = "technical"
    description = "随机指标D线（STOCH %D）"
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


class MacdFactor(Factor):
    name = "MACD主线"
    group = "technical"
    description = "MACD主线"
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


class MacdSignalFactor(Factor):
    name = "MACD信号线"
    group = "technical"
    description = "MACD信号线"
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


class MacdHistFactor(Factor):
    name = "MACD柱"
    group = "technical"
    description = "MACD柱"
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


class AtrFactor(Factor):
    name = "平均真实波动幅度"
    group = "technical"
    description = "平均真实波动幅度（ATR）"
    param_specs = ({"name": "window", "label": "窗口", "default": 14, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["window"])

    def calc(self, high: pd.DataFrame, low: pd.DataFrame, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.ATR.run(high, low, close, window=int(self.params["window"])).atr


class ObvFactor(Factor):
    name = "能量潮指标"
    group = "technical"
    description = "能量潮指标（OBV）"

    @property
    def window(self) -> int:
        return 1

    def calc(self, close: pd.DataFrame, volume: pd.DataFrame) -> pd.DataFrame:
        return vbt.OBV.run(close, volume).obv
