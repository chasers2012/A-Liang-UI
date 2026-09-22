from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.infra.plugin import Plugin
from app.packages.evaluation.profile import controller


@dataclass(frozen=True)
class EvaluationProfileWorkflowSpec:
    name: str
    description: str = ""
    workflow: dict[str, Any] | None = None


class EvaluationProfilePlugin(Plugin):
    category: str = "evaluation-profile"
    workflows: list[EvaluationProfileWorkflowSpec]

    def on_registered(self) -> None:
        for workflow_spec in self.workflows:
            controller.register_plugin_evaluation_profile_workflow(workflow_spec)
