import json
from pathlib import Path
from typing import Any, ClassVar

from app.evaluation.profile.profile_plugin import (
    EvaluationProfilePlugin,
    EvaluationProfileWorkflowSpec,
)


def _load_workflow_json(filename: str) -> dict[str, Any]:
    workflow_path = Path(__file__).resolve().parent / "workflows" / filename
    return json.loads(workflow_path.read_text(encoding="utf-8"))


class ExampleEvaluationProfilesPlugin(EvaluationProfilePlugin):
    name = "example-evaluation-profiles"
    workflows: ClassVar[list[EvaluationProfileWorkflowSpec]] = [
        EvaluationProfileWorkflowSpec(
            name="插件示例：Echarts 画廊",
            description="通过 evaluation profile plugin 自动注入的示例评价方案。",
            workflow=_load_workflow_json("echarts_gallery_workflow.json"),
        )
    ]
