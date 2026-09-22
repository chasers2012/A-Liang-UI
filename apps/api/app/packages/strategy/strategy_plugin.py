from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.packages.plugin import Plugin
from app.packages.strategy import controller


@dataclass(frozen=True)
class StrategyWorkflowSpec:
    id: str
    name: str
    description: str = ""
    workflow: dict[str, Any] | None = None


class StrategyPlugin(Plugin):
    category: str = "strategy"
    workflows: list[StrategyWorkflowSpec]

    def on_registered(self) -> None:
        for workflow_spec in self.workflows:
            controller.register_plugin_strategy_workflow(workflow_spec)
