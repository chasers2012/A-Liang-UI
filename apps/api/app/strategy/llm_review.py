from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field
from workflow.schemas import WorkflowGraphPersisted

from app.llm_tools.review_with_llm import review_with_llm


class _StrategyWorkflowReview(BaseModel):
    approved: bool
    issues: list[str] = Field(default_factory=list)


def _build_workflow_schema_descriptions() -> dict[str, Any]:
    schema = WorkflowGraphPersisted.model_json_schema(by_alias=True)
    return {
        "root": "WorkflowGraphPersisted",
        "description": schema.get("description"),
        "properties": schema.get("properties", {}),
        "$defs": schema.get("$defs", {}),
    }


def review_strategy_workflow_with_llm(
    *,
    name: str,
    description: str,
    workflow: WorkflowGraphPersisted,
    strategy_id: str | None = None,
) -> dict[str, Any]:
    from app.nodes import controller as nodes_controller

    workflow_payload = workflow.model_dump(by_alias=True)
    used_node_type_ids = sorted(
        {
            str(node.get("type")).strip()
            for node in (workflow_payload.get("nodes") or [])
            if isinstance(node, dict) and str(node.get("type", "")).strip()
        }
    )
    used_node_details = [
        item.model_dump() for item in nodes_controller.load_node_details(used_node_type_ids)
    ]
    prompt = (
        "请审查下面的策略工作流是否可用，重点检查："
        "结构完整性（节点/连线是否明显异常）、参数合理性、潜在运行风险、工作流出入口是否完整连接、是否存在闭环、中断、"
        "以及名称描述与工作流意图是否一致。"
    )
    context = {
        "strategy_id": strategy_id,
        "name": name,
        "description": description,
        "workflow": workflow_payload,
        "workflow_schema_descriptions": _build_workflow_schema_descriptions(),
        "used_node_details": used_node_details,
    }
    return review_with_llm(
        system_prompt="你是严格的策略工作流审查助手。",
        review_prompt=prompt,
        review_input=context,
        output_model=_StrategyWorkflowReview,
        input_format="json",
        input_title="审查对象如下：",
        reject_message_prefix="策略工作流审查未通过",
    )
