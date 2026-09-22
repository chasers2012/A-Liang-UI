from __future__ import annotations

from factor import Factor

from app.infra.plugin import Plugin
from app.packages.factors import controller


class FactorPlugin(Plugin):
    category: str = "factors"
    factors: list[type[Factor]]

    def on_registered(self) -> None:
        for factor_cls in self.factors:
            controller.register_plugin_factor(factor_cls)
