from __future__ import annotations

from factor import Factor

from app.factors.registry import FactorItemsRegistry
from app.plugin import Plugin


class FactorPlugin(Plugin):
    category: str = "factors"
    factors: list[type[Factor]]

    def register_factors(self) -> None:
        for factor_cls in self.factors:
            factor_id = getattr(factor_cls, "name", "")
            if not isinstance(factor_id, str) or not factor_id.strip():
                continue
            FactorItemsRegistry.register_plugin_factor(factor_id.strip(), factor_cls)

    def on_registered(self) -> None:
        self.register_factors()
