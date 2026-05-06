from __future__ import annotations

from typing import Any, ClassVar

import pandas as pd
import vectorbt as vbt
from workflow import Socket, workflow_node
from workflow.node_types import NumberNodeParam


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam("window", required=True, default=20, minimum=1, maximum=250, label="窗口"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="MA")],
    label="移动平均 (MA)",
    description="移动平均（MA）。输入为宽表 close（index=date, columns=asset）。",
    category="technical",
)
class MaNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        close: pd.DataFrame = kwargs["close"]
        try:
            window = int(kwargs.get("window", 20))
        except Exception as e:
            raise ValueError("window 必须是整数") from e
        if window < 1:
            raise ValueError("window 必须 >= 1")
        return vbt.MA.run(close, window=window, ewm=False).ma


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam("window", required=True, default=20, minimum=1, maximum=250, label="窗口"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="EMA")],
    label="指数移动平均 (EMA)",
    description="指数移动平均（EMA）。输入为宽表 close（index=date, columns=asset）。",
    category="technical",
)
class EmaNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        close: pd.DataFrame = kwargs["close"]
        try:
            window = int(kwargs.get("window", 20))
        except Exception as e:
            raise ValueError("window 必须是整数") from e
        if window < 1:
            raise ValueError("window 必须 >= 1")
        return vbt.MA.run(close, window=window, ewm=True).ma


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam("window", required=True, default=20, minimum=1, maximum=250, label="窗口"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="MSTD")],
    label="移动标准差 (MSTD)",
    description="移动标准差（MSTD）。输入为宽表 close（index=date, columns=asset）。",
    category="technical",
)
class MstdNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        close: pd.DataFrame = kwargs["close"]
        try:
            window = int(kwargs.get("window", 20))
        except Exception as e:
            raise ValueError("window 必须是整数") from e
        if window < 1:
            raise ValueError("window 必须 >= 1")
        return vbt.MSTD.run(close, window=window, ewm=False).mstd


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam("window", required=True, default=20, minimum=1, maximum=250, label="窗口"),
    ],
    output_sockets=[
        Socket("middle", required=True, value_type="dataframe", label="BBANDS middle"),
        Socket("upper", required=True, value_type="dataframe", label="BBANDS upper"),
        Socket("lower", required=True, value_type="dataframe", label="BBANDS lower"),
    ],
    label="布林带 (BBANDS)",
    description="布林带指标（middle/upper/lower）。输入为宽表 close。",
    category="technical",
)
class BbandsNode:
    def execute(self, **kwargs: Any) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        close: pd.DataFrame = kwargs["close"]
        try:
            window = int(kwargs.get("window", 20))
        except Exception as e:
            raise ValueError("window 必须是整数") from e
        if window < 1:
            raise ValueError("window 必须 >= 1")
        bbands = vbt.BBANDS.run(close, window=window)
        return (bbands.middle, bbands.upper, bbands.lower)


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam("window", required=True, default=14, minimum=1, maximum=250, label="窗口"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="RSI")],
    label="相对强弱指标 (RSI)",
    description="相对强弱指标（RSI）。输入为宽表 close。",
    category="technical",
)
class RsiNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        close: pd.DataFrame = kwargs["close"]
        try:
            window = int(kwargs.get("window", 14))
        except Exception as e:
            raise ValueError("window 必须是整数") from e
        if window < 1:
            raise ValueError("window 必须 >= 1")
        return vbt.RSI.run(close, window=window).rsi


@workflow_node(
    input_sockets=[
        Socket("high", required=True, value_type="dataframe", label="最高价(high)"),
        Socket("low", required=True, value_type="dataframe", label="最低价(low)"),
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam(
            "k_window", required=True, default=14, minimum=1, maximum=250, label="K窗口"
        ),
        NumberNodeParam(
            "d_window", required=True, default=3, minimum=1, maximum=250, label="D窗口"
        ),
    ],
    output_sockets=[
        Socket("percent_k", required=True, value_type="dataframe", label="STOCH %K"),
        Socket("percent_d", required=True, value_type="dataframe", label="STOCH %D"),
    ],
    label="随机指标 (STOCH)",
    description="随机指标（%K/%D）。输入为宽表 high/low/close。",
    category="technical",
)
class StochNode:
    def execute(self, **kwargs: Any) -> tuple[pd.DataFrame, pd.DataFrame]:
        high: pd.DataFrame = kwargs["high"]
        low: pd.DataFrame = kwargs["low"]
        close: pd.DataFrame = kwargs["close"]
        try:
            k_window = int(kwargs.get("k_window", 14))
        except Exception as e:
            raise ValueError("k_window 必须是整数") from e
        if k_window < 1:
            raise ValueError("k_window 必须 >= 1")
        try:
            d_window = int(kwargs.get("d_window", 3))
        except Exception as e:
            raise ValueError("d_window 必须是整数") from e
        if d_window < 1:
            raise ValueError("d_window 必须 >= 1")
        stoch = vbt.STOCH.run(high, low, close, k_window=k_window, d_window=d_window)
        return (stoch.percent_k, stoch.percent_d)


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam(
            "fast_window", required=True, default=12, minimum=1, maximum=250, label="快线窗口"
        ),
        NumberNodeParam(
            "slow_window", required=True, default=26, minimum=1, maximum=250, label="慢线窗口"
        ),
        NumberNodeParam(
            "signal_window", required=True, default=9, minimum=1, maximum=250, label="信号窗口"
        ),
    ],
    output_sockets=[
        Socket("macd", required=True, value_type="dataframe", label="MACD主线"),
        Socket("signal", required=True, value_type="dataframe", label="MACD信号线"),
        Socket("hist", required=True, value_type="dataframe", label="MACD柱"),
    ],
    label="MACD",
    description="MACD 指标（macd/signal/hist）。输入为宽表 close。",
    category="technical",
)
class MacdNode:
    def execute(self, **kwargs: Any) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        close: pd.DataFrame = kwargs["close"]
        try:
            fast_window = int(kwargs.get("fast_window", 12))
        except Exception as e:
            raise ValueError("fast_window 必须是整数") from e
        if fast_window < 1:
            raise ValueError("fast_window 必须 >= 1")
        try:
            slow_window = int(kwargs.get("slow_window", 26))
        except Exception as e:
            raise ValueError("slow_window 必须是整数") from e
        if slow_window < 1:
            raise ValueError("slow_window 必须 >= 1")
        try:
            signal_window = int(kwargs.get("signal_window", 9))
        except Exception as e:
            raise ValueError("signal_window 必须是整数") from e
        if signal_window < 1:
            raise ValueError("signal_window 必须 >= 1")
        macd = vbt.MACD.run(
            close,
            fast_window=fast_window,
            slow_window=slow_window,
            signal_window=signal_window,
        )
        return (macd.macd, macd.signal, macd.hist)


@workflow_node(
    input_sockets=[
        Socket("high", required=True, value_type="dataframe", label="最高价(high)"),
        Socket("low", required=True, value_type="dataframe", label="最低价(low)"),
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        NumberNodeParam("window", required=True, default=14, minimum=1, maximum=250, label="窗口"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="ATR")],
    label="平均真实波动幅度 (ATR)",
    description="平均真实波动幅度（ATR）。输入为宽表 high/low/close。",
    category="technical",
)
class AtrNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        high: pd.DataFrame = kwargs["high"]
        low: pd.DataFrame = kwargs["low"]
        close: pd.DataFrame = kwargs["close"]
        try:
            window = int(kwargs.get("window", 14))
        except Exception as e:
            raise ValueError("window 必须是整数") from e
        if window < 1:
            raise ValueError("window 必须 >= 1")
        return vbt.ATR.run(high, low, close, window=window).atr


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="dataframe", label="收盘价(close)"),
        Socket("volume", required=True, value_type="dataframe", label="成交量(volume)"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="OBV")],
    label="能量潮指标 (OBV)",
    description="能量潮指标（OBV）。输入为宽表 close/volume。",
    category="technical",
)
class ObvNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        close: pd.DataFrame = kwargs["close"]
        volume: pd.DataFrame = kwargs["volume"]
        return vbt.OBV.run(close, volume).obv


__all__: ClassVar[list[str]] = [
    "AtrNode",
    "BbandsNode",
    "EmaNode",
    "MaNode",
    "MacdNode",
    "MstdNode",
    "ObvNode",
    "RsiNode",
    "StochNode",
]
