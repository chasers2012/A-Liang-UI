from typing import ClassVar

from app.factors.factor_plugin import FactorPlugin

from example_factors.factors import (
    LowVolatilityFactor,
    Momentum10dFactor,
    ShortTermReversalFactor,
)


class ExampleFactorsPlugin(FactorPlugin):
    name = "example-factors"
    factors: ClassVar[list[type]] = [
        Momentum10dFactor,
        ShortTermReversalFactor,
        LowVolatilityFactor,
    ]
