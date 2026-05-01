from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from workflow.schemas import WorkflowGraphPersisted


def _extract_json_block(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        parts = stripped.split("```")
        for part in parts:
            candidate = part.strip()
            if candidate.startswith("json"):
                payload = candidate[4:].strip()
                if payload:
                    return payload
    return stripped


def review_strategy_workflow_with_llm(
    *,
    name: str,
    description: str,
    workflow: WorkflowGraphPersisted,
    strategy_id: str | None = None,
) -> dict[str, Any]:
    # Lazy import avoids introducing module import cycles.
    from app.chat.controller import build_chat_model
    from app.nodes import controller as nodes_controller

    llm = build_chat_model()
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
        "请仅输出 JSON，格式为："
        '{"approved": boolean, "issues": [string]}'
        "。如果没有问题，issues 传空数组。"
    )
    context = {
        "strategy_id": strategy_id,
        "name": name,
        "description": description,
        "workflow": workflow_payload,
        "used_node_details": used_node_details,
    }
    resp = llm.invoke(
        [
            SystemMessage(content="你是严格的策略工作流审查助手，必须返回一个 JSON。"),
            HumanMessage(
                content=f"{prompt}\n\n审查对象如下：\n```json\n{json.dumps(context, ensure_ascii=False)}\n```"
            ),
        ],
        config={"metadata": {"silent_stream": True}},
    )

    content = resp.content if isinstance(resp.content, str) else str(resp.content)
    raw = _extract_json_block(content)
    try:
        review = json.loads(raw)
    except Exception as exc:
        raise ValueError(f"LLM 审查结果不可解析：{exc}, 审查结果：{raw}") from exc

    approved = bool(review.get("approved", False))
    issues = review.get("issues") or []
    if not approved:
        issue_text = "；".join(str(x) for x in issues if str(x).strip()) or "未通过 LLM 审查"
        raise ValueError(f"策略工作流审查未通过：{issue_text}")

    return review
