from __future__ import annotations

import pandas as pd
import vectorbt as vbt
from factor import Factor


class Ma20Factor(Factor):
    name = "ma_20"
    group = "technical"
    description = "20日移动平均（MA）"
    window = 20

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MA.run(close, window=self.window, ewm=False).ma


class Ema20Factor(Factor):
    name = "ema_20"
    group = "technical"
    description = "20日指数移动平均（EMA）"
    window = 20

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MA.run(close, window=self.window, ewm=True).ma


class Mstd20Factor(Factor):
    name = "mstd_20"
    group = "technical"
    description = "20日移动标准差（MSTD）"
    window = 20

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MSTD.run(close, window=self.window, ewm=False).mstd


class BbandsMiddle20Factor(Factor):
    name = "bbands_middle_20"
    group = "technical"
    description = "20日布林带中轨（BBANDS middle）"
    window = 20

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=self.window).middle


class BbandsUpper20Factor(Factor):
    name = "bbands_upper_20"
    group = "technical"
    description = "20日布林带上轨（BBANDS upper）"
    window = 20

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=self.window).upper


class BbandsLower20Factor(Factor):
    name = "bbands_lower_20"
    group = "technical"
    description = "20日布林带下轨（BBANDS lower）"
    window = 20

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.BBANDS.run(close, window=self.window).lower


class Rsi14Factor(Factor):
    name = "rsi_14"
    group = "technical"
    description = "14日相对强弱指标（RSI）"
    window = 14

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.RSI.run(close, window=self.window).rsi


class StochPercentK143Factor(Factor):
    name = "stoch_k_14_3"
    group = "technical"
    description = "随机指标K线（STOCH %K, 14/3）"
    window = 14

    def calc(self, high: pd.DataFrame, low: pd.DataFrame, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.STOCH.run(high, low, close, k_window=self.window, d_window=3).percent_k


class StochPercentD143Factor(Factor):
    name = "stoch_d_14_3"
    group = "technical"
    description = "随机指标D线（STOCH %D, 14/3）"
    window = 14

    def calc(self, high: pd.DataFrame, low: pd.DataFrame, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.STOCH.run(high, low, close, k_window=self.window, d_window=3).percent_d


class Macd12269Factor(Factor):
    name = "macd_12_26_9"
    group = "technical"
    description = "MACD主线（12,26,9）"
    window = 26

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MACD.run(close, fast_window=12, slow_window=26, signal_window=9).macd


class MacdSignal12269Factor(Factor):
    name = "macd_signal_12_26_9"
    group = "technical"
    description = "MACD信号线（12,26,9）"
    window = 26

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MACD.run(close, fast_window=12, slow_window=26, signal_window=9).signal


class MacdHist12269Factor(Factor):
    name = "macd_hist_12_26_9"
    group = "technical"
    description = "MACD柱（12,26,9）"
    window = 26

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.MACD.run(close, fast_window=12, slow_window=26, signal_window=9).hist


class Atr14Factor(Factor):
    name = "atr_14"
    group = "technical"
    description = "14日平均真实波动幅度（ATR）"
    window = 14

    def calc(self, high: pd.DataFrame, low: pd.DataFrame, close: pd.DataFrame) -> pd.DataFrame:
        return vbt.ATR.run(high, low, close, window=self.window).atr


class ObvFactor(Factor):
    name = "obv"
    group = "technical"
    description = "能量潮指标（OBV）"
    window = 1

    def calc(self, close: pd.DataFrame, volume: pd.DataFrame) -> pd.DataFrame:
        return vbt.OBV.run(close, volume).obv
