import json
from pathlib import Path
from typing import Any, ClassVar

from app.strategy.strategy_plugin import StrategyPlugin, StrategyWorkflowSpec


def _load_workflow_json(filename: str) -> dict[str, Any]:
    workflow_path = Path(__file__).resolve().parent / "workflows" / filename
    return json.loads(workflow_path.read_text(encoding="utf-8"))


class ExampleStrategiesPlugin(StrategyPlugin):
    name = "example-strategies"
    workflows: ClassVar[list[StrategyWorkflowSpec]] = [
        StrategyWorkflowSpec(
            id="plugin-example-topk-equal-weight",
            name="插件示例：TopK 等权轮动",
            description="通过 strategy plugin 在挂载时自动注入的示例策略工作流。",
            workflow=_load_workflow_json("topk_equal_weight.json"),
        )
    ]
