from typing import ClassVar

from app.factors.factor_plugin import FactorPlugin
from factor import Factor

from technical_factors.factors import (
    Atr14Factor,
    BbandsLower20Factor,
    BbandsMiddle20Factor,
    BbandsUpper20Factor,
    Ema20Factor,
    Ma20Factor,
    Macd12269Factor,
    MacdHist12269Factor,
    MacdSignal12269Factor,
    Mstd20Factor,
    ObvFactor,
    Rsi14Factor,
    StochPercentD143Factor,
    StochPercentK143Factor,
)


class TechnicalFactorsPlugin(FactorPlugin):
    name = "technical-factors"
    factors: ClassVar[list[type[Factor]]] = [
        Ma20Factor,
        Ema20Factor,
        Mstd20Factor,
        BbandsMiddle20Factor,
        BbandsUpper20Factor,
        BbandsLower20Factor,
        Rsi14Factor,
        StochPercentK143Factor,
        StochPercentD143Factor,
        Macd12269Factor,
        MacdSignal12269Factor,
        MacdHist12269Factor,
        Atr14Factor,
        ObvFactor,
    ]
