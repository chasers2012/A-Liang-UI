from typing import ClassVar

from app.factors.factor_plugin import FactorPlugin
from factor import Factor

from technical_factors.factors import (
    AtrFactor,
    BbandsLowerFactor,
    BbandsMiddleFactor,
    BbandsUpperFactor,
    EmaFactor,
    MacdFactor,
    MacdHistFactor,
    MacdSignalFactor,
    MaFactor,
    MstdFactor,
    ObvFactor,
    RsiFactor,
    StochPercentDFactor,
    StochPercentKFactor,
)


class TechnicalFactorsPlugin(FactorPlugin):
    name = "technical-factors"
    factors: ClassVar[list[type[Factor]]] = [
        MaFactor,
        EmaFactor,
        MstdFactor,
        BbandsMiddleFactor,
        BbandsUpperFactor,
        BbandsLowerFactor,
        RsiFactor,
        StochPercentKFactor,
        StochPercentDFactor,
        MacdFactor,
        MacdSignalFactor,
        MacdHistFactor,
        AtrFactor,
        ObvFactor,
    ]
