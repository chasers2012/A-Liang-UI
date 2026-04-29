from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from typing import Any

from langchain.tools import ToolRuntime
from langchain_core.messages import HumanMessage, SystemMessage
from workflow.schemas import WorkflowGraphPersisted

from app.strategy.controller import (
    add_node,
    connect_nodes,
    connect_to_workflow_output,
    connect_workflow_input,
    create_strategy,
    delete_strategy,
    disconnect_between,
    disconnect_link,
    get_strategy,
    get_strategy_workflow_template,
    list_strategies,
    list_strategy_nodes,
    move_node,
    patch_strategy,
    remove_node,
    set_node_param,
    unset_node_param,
)
from app.strategy.schemas import StrategyCreate, StrategyPatch
from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool

_WORKFLOW_DRAFT_STORE_LOCK = asyncio.Lock()


def _get_runtime_thread_id(runtime: ToolRuntime) -> str:
    cfg = runtime.config if isinstance(runtime.config, dict) else {}
    configurable = cfg.get("configurable", {}) if isinstance(cfg, dict) else {}
    thread_id: Any = None
    if isinstance(configurable, dict):
        thread_id = configurable.get("thread_id")
    if not thread_id and isinstance(cfg, dict):
        thread_id = cfg.get("thread_id")
    if not thread_id:
        raise ValueError("缺少 thread_id，无法定位 workflowDraft 存储命名空间")
    return str(thread_id)


async def _load_workflow_draft_record_from_store(runtime: ToolRuntime) -> dict[str, Any]:
    store = runtime.store
    if store is None:
        raise ValueError("当前运行时未配置 store，无法读取 workflowDraft")
    item = await store.aget(_workflow_draft_namespace(runtime), "workflowDraft")
    record = item.value if item and isinstance(item.value, dict) else {}
    raw = record.get("workflow")
    if raw is None:
        raise ValueError("缺少 workflowDraft，请先在会话上下文中初始化策略工作流草稿")
    return record


async def _load_workflow_draft_from_store(runtime: ToolRuntime) -> WorkflowGraphPersisted:
    record = await _load_workflow_draft_record_from_store(runtime)
    raw = record.get("workflow")
    if isinstance(raw, WorkflowGraphPersisted):
        return raw
    return WorkflowGraphPersisted.model_validate(raw)


async def _save_workflow_draft_to_store(
    runtime: ToolRuntime,
    workflow: WorkflowGraphPersisted,
    *,
    strategy_id: str | None = None,
    is_dirty: bool = False,
) -> None:
    store = runtime.store
    if store is None:
        raise ValueError("当前运行时未配置 store，无法写入 workflowDraft")
    await store.aput(
        _workflow_draft_namespace(runtime),
        "workflowDraft",
        {
            "workflow": workflow.model_dump(by_alias=True),
            "strategy_id": strategy_id,
            "is_dirty": is_dirty,
        },
    )


async def _require_workflow_draft_record(runtime: ToolRuntime) -> dict[str, Any]:
    async with _WORKFLOW_DRAFT_STORE_LOCK:
        return await _load_workflow_draft_record_from_store(runtime)


def _draft_strategy_id(record: dict[str, Any]) -> str | None:
    raw = record.get("strategy_id")
    return str(raw) if raw else None


def _draft_is_dirty(record: dict[str, Any]) -> bool:
    return bool(record.get("is_dirty", False))


async def _mutate_workflow_draft(
    runtime: ToolRuntime,
    mutator: Callable[[WorkflowGraphPersisted], tuple[WorkflowGraphPersisted, dict[str, Any]]],
) -> dict[str, Any]:
    async with _WORKFLOW_DRAFT_STORE_LOCK:
        record = await _load_workflow_draft_record_from_store(runtime)
        workflow_raw = record.get("workflow")
        workflow = (
            workflow_raw
            if isinstance(workflow_raw, WorkflowGraphPersisted)
            else WorkflowGraphPersisted.model_validate(workflow_raw)
        )
        out_workflow, result = mutator(workflow)
        await _save_workflow_draft_to_store(
            runtime,
            out_workflow,
            strategy_id=_draft_strategy_id(record),
            is_dirty=True,
        )
    return result


async def _require_workflow_draft(runtime: ToolRuntime) -> WorkflowGraphPersisted:
    async with _WORKFLOW_DRAFT_STORE_LOCK:
        return await _load_workflow_draft_from_store(runtime)


async def _set_workflow_draft(runtime: ToolRuntime, workflow: WorkflowGraphPersisted) -> None:
    async with _WORKFLOW_DRAFT_STORE_LOCK:
        await _save_workflow_draft_to_store(runtime, workflow)


def _workflow_draft_namespace(runtime: ToolRuntime) -> tuple[str, ...]:
    return ("strategy", "workflowDraft", _get_runtime_thread_id(runtime))


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


def _review_strategy_workflow_with_llm(
    *,
    name: str,
    description: str,
    workflow: WorkflowGraphPersisted,
    strategy_id: str | None = None,
) -> dict[str, Any]:
    # Lazy import avoids introducing module import cycles.
    from app.chat.controller import build_chat_model

    llm = build_chat_model()
    workflow_payload = workflow.model_dump(by_alias=True)
    prompt = (
        "请审查下面的策略工作流是否可用，重点检查："
        "结构完整性（节点/连线是否明显异常）、参数合理性、潜在运行风险、工作流出入口是否完整连接、是否存在闭环、中断、"
        "以及名称描述与工作流意图是否一致。"
        "请仅输出 JSON，格式为："
        '{"approved": boolean, "summary": string, "issues": [string], "suggestions": [string]}'
        "。如果没有问题，issues 传空数组。"
    )
    context = {
        "strategy_id": strategy_id,
        "name": name,
        "description": description,
        "workflow": workflow_payload,
    }
    resp = llm.invoke(
        [
            SystemMessage(content="你是严格的策略工作流审查助手，只返回 JSON。"),
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
        raise ValueError(f"LLM 审查结果不可解析：{exc}") from exc

    approved = bool(review.get("approved", False))
    issues = review.get("issues") or []
    if not approved:
        issue_text = "；".join(str(x) for x in issues if str(x).strip()) or "未通过 LLM 审查"
        raise ValueError(f"策略工作流审查未通过：{issue_text}")
    return {
        "approved": True,
        "summary": str(review.get("summary", "")).strip(),
        "issues": [str(x) for x in issues if str(x).strip()],
        "suggestions": [str(x) for x in (review.get("suggestions") or []) if str(x).strip()],
    }


@safe_tool(
    "加载策略工作流模板",
    description="加载策略工作流模板。\n将工作流模板加载到store, 用于初始化策略编辑结构，这会覆盖现在的store中的workflowDraft，后续可基于模板填充节点与连线。",
)
async def get_strategy_workflow_template_tool(runtime: ToolRuntime) -> dict[str, Any]:
    template = get_strategy_workflow_template()
    await _save_workflow_draft_to_store(
        runtime,
        WorkflowGraphPersisted.model_validate(template),
        strategy_id=None,
        is_dirty=False,
    )
    return template


@safe_tool(
    "获取策略可用节点",
    description="列出策略域可用工作流节点。\n返回节点类型定义（含输入/输出端口）用于前端节点选择器。",
)
def get_strategy_node_catalog() -> list[dict[str, Any]]:
    return [item.model_dump() for item in list_strategy_nodes()]


@safe_tool(
    "查看工作流草稿",
    description="读取当前编辑中的工作流草稿。\n返回 store 中的workflowDraft 暂存的策略工作流草稿内容。草稿中的值是一个临时值，必须调用创建策略工具或更新策略工具后才会生效。",
)
async def get_strategy_workflow_draft(runtime: ToolRuntime) -> dict[str, Any]:
    record = await _require_workflow_draft_record(runtime)
    workflow = await _require_workflow_draft(runtime)
    return {
        "workflow": workflow.model_dump(by_alias=True),
        "strategy_id": _draft_strategy_id(record),
        "is_dirty": _draft_is_dirty(record),
    }


@safe_tool(
    "创建策略",
    description="创建并保存策略。\n入参 name、description；使用store中的workflowDraft创建策略并返回创建后的策略详情。任何创建的新策略都要调用此工具才会生效。",
)
async def create_strategy_tool(name: str, description: str, runtime: ToolRuntime) -> dict[str, Any]:
    record = await _require_workflow_draft_record(runtime)
    if _draft_strategy_id(record):
        raise ValueError("当前草稿已绑定现有策略，请使用更新策略工具保存修改")

    workflow = await _require_workflow_draft(runtime)
    review = _review_strategy_workflow_with_llm(
        name=name,
        description=description,
        workflow=workflow,
    )
    strategy = create_strategy(
        StrategyCreate(name=name, description=description, workflow=workflow)
    )
    strategy_id = (
        strategy.get("id") if isinstance(strategy, dict) else getattr(strategy, "id", None)
    )
    await _save_workflow_draft_to_store(
        runtime,
        workflow,
        strategy_id=str(strategy_id) if strategy_id else None,
        is_dirty=False,
    )
    out = dict(strategy) if isinstance(strategy, dict) else strategy.model_dump()
    out["review"] = review
    return out


@safe_tool(
    "获取策略详情",
    description="查询单个策略详情。\n获取已存在的策略的完整信息入参 strategy_id；不存在时报错。",
)
def get_strategy_detail(strategy_id: str) -> dict[str, Any]:
    return get_strategy(strategy_id)


@safe_tool(
    "加载策略",
    description="加载策略以便编辑。\n将已存在的策略的工作流加载到store中的workflowDraft以便用于修改，这会覆盖现在的store中的workflowDraft，入参 strategy_id；不存在时报错。",
)
async def load_strategy_detail(strategy_id: str, runtime: ToolRuntime) -> dict[str, Any]:
    strategy = get_strategy(strategy_id)
    if strategy is None:
        raise ValueError(f"策略不存在: {strategy_id}")

    if isinstance(strategy, dict):
        workflow_raw = strategy.get("workflow")
    else:
        workflow_raw = getattr(strategy, "workflow", None)
    if workflow_raw is None:
        raise ValueError(f"策略缺少 workflow: {strategy_id}")

    await _save_workflow_draft_to_store(
        runtime,
        WorkflowGraphPersisted.model_validate(workflow_raw),
        strategy_id=strategy_id,
        is_dirty=False,
    )
    return strategy


@safe_tool(
    "获取策略列表",
    description="查询当前工作区策略列表。\n返回策略列表用于选择运行或编辑目标。",
)
def get_strategy_list() -> list[dict[str, Any]]:
    return [i.model_dump() for i in list_strategies()]


@safe_tool(
    "更新策略",
    description="更新策略配置。\n入参 strategy_id、name、description；使用store中的workflowDraft更新策略并返回更新后的策略详情。任何对现有策略的修改都要调用此工具才会生效。",
)
async def update_strategy(
    strategy_id: str, name: str, description: str, runtime: ToolRuntime
) -> dict[str, Any]:
    record = await _require_workflow_draft_record(runtime)
    draft_strategy_id = _draft_strategy_id(record)
    if not draft_strategy_id:
        raise ValueError("当前草稿尚未绑定策略，请先创建策略")
    if draft_strategy_id != strategy_id:
        raise ValueError(
            f"当前草稿绑定的策略ID为 {draft_strategy_id}，不能更新其他策略 {strategy_id}"
        )

    workflow = await _require_workflow_draft(runtime)
    review = _review_strategy_workflow_with_llm(
        strategy_id=strategy_id,
        name=name,
        description=description,
        workflow=workflow,
    )
    strategy = patch_strategy(
        strategy_id,
        StrategyPatch(name=name, description=description, workflow=workflow),
    )
    await _save_workflow_draft_to_store(
        runtime,
        workflow,
        strategy_id=strategy_id,
        is_dirty=False,
    )
    out = dict(strategy) if isinstance(strategy, dict) else strategy.model_dump()
    out["review"] = review
    return out


@safe_tool("删除策略", description="删除指定策略。\n入参 strategy_id；返回删除前记录。")
def delete_strategy_tool(strategy_id: str) -> dict[str, Any]:
    row = get_strategy(strategy_id)
    delete_strategy(strategy_id)
    return row


@safe_tool(
    "策略工作流-添加节点",
    description=(
        "向工作流追加指定类型节点。\n"
        "向 ToolContext.workflowDraft 草稿中添加指定类型的节点并返回新节点 node_id。"
    ),
)
async def strategy_workflow_add_node(
    node_type_id: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (
            lambda out_workflow, node_id: (
                out_workflow,
                {"node_id": node_id},
            )
        )(*add_node(workflow, node_type_id)),
    )


@safe_tool(
    "策略工作流-删除节点",
    description="删除指定节点并自动清理关联连线。\n入参 node_id；基于 ToolContext.workflowDraft 更新草稿。",
)
async def strategy_workflow_remove_node(node_id: str, runtime: ToolRuntime) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (remove_node(workflow, node_id), {"ok": True}),
    )


@safe_tool(
    "策略工作流-移动节点",
    description="设置节点画布坐标。\n入参 node_id、pos([x, y])；基于 ToolContext.workflowDraft 更新草稿。",
)
async def strategy_workflow_move_node(
    node_id: str,
    pos: list[float] | tuple[float, float],
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (move_node(workflow, node_id, pos), {"ok": True}),
    )


@safe_tool(
    "策略工作流-设置节点参数",
    description="设置节点单个参数。\n入参 node_id、key、value；基于 ToolContext.workflowDraft 更新草稿。",
)
async def strategy_workflow_set_node_param(
    node_id: str,
    key: str,
    value: Any,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (
            set_node_param(workflow, node_id, key, value),
            {"ok": True},
        ),
    )


@safe_tool(
    "策略工作流-移除节点参数",
    description="移除节点参数键。\n入参 node_id、key；基于 ToolContext.workflowDraft 更新草稿。",
)
async def strategy_workflow_unset_node_param(
    node_id: str,
    key: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (unset_node_param(workflow, node_id, key), {"ok": True}),
    )


@safe_tool(
    "策略工作流-连接节点",
    description=(
        "创建节点到节点连线。\n"
        "入参 from_node_id、from_socket、to_node_id、to_socket，可选 link_id；"
        "基于 ToolContext.workflowDraft 更新草稿并返回 link_id。"
        "注意只有value_type相同的socket才能连接"
    ),
)
async def strategy_workflow_connect_nodes(
    from_node_id: str,
    from_socket: str,
    to_node_id: str,
    to_socket: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (
            lambda out_workflow, created_link_id: (
                out_workflow,
                {"link_id": created_link_id},
            )
        )(*connect_nodes(workflow, from_node_id, from_socket, to_node_id, to_socket)),
    )


@safe_tool(
    "策略工作流-连接工作流输入",
    description=(
        "创建 workflow_input 到节点输入连线。\n"
        "入参 input_socket、to_node_id、to_socket，可选 link_id；"
        "基于 ToolContext.workflowDraft 更新草稿并返回 link_id。"
        "注意只有value_type相同的socket才能连接"
    ),
)
async def strategy_workflow_connect_input(
    input_socket: str,
    to_node_id: str,
    to_socket: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (
            lambda out_workflow, created_link_id: (
                out_workflow,
                {"link_id": created_link_id},
            )
        )(*connect_workflow_input(workflow, input_socket, to_node_id, to_socket)),
    )


@safe_tool(
    "策略工作流-连接工作流输出",
    description=(
        "创建节点输出到 workflow_output 连线。\n"
        "入参 from_node_id、from_socket、output_socket，可选 link_id；"
        "基于 ToolContext.workflowDraft 更新草稿并返回 link_id。"
        "注意只有value_type相同的socket才能连接"
    ),
)
async def strategy_workflow_connect_output(
    from_node_id: str,
    from_socket: str,
    output_socket: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (
            lambda out_workflow, created_link_id: (
                out_workflow,
                {"link_id": created_link_id},
            )
        )(*connect_to_workflow_output(workflow, from_node_id, from_socket, output_socket)),
    )


@safe_tool(
    "策略工作流-按连线ID断开",
    description="按 link_id 删除连线。\n入参 link_id；基于 ToolContext.workflowDraft 更新草稿。",
)
async def strategy_workflow_disconnect_link(
    link_id: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (disconnect_link(workflow, link_id), {"ok": True}),
    )


@safe_tool(
    "策略工作流-按端点断开",
    description=(
        "按起止端点删除 node->node 连线。\n"
        "入参 from_node_id、from_socket、to_node_id、to_socket；基于 ToolContext.workflowDraft 更新草稿。"
    ),
)
async def strategy_workflow_disconnect_between(
    from_node_id: str,
    from_socket: str,
    to_node_id: str,
    to_socket: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    return await _mutate_workflow_draft(
        runtime,
        lambda workflow: (
            disconnect_between(workflow, from_node_id, from_socket, to_node_id, to_socket),
            {"ok": True},
        ),
    )


TOOLS = {
    "strategy.get_strategy_workflow_template": (
        get_strategy_workflow_template_tool,
        ToolAuthorization.allowed,
    ),
    "strategy.get_strategy_node_catalog": (
        get_strategy_node_catalog,
        ToolAuthorization.allowed,
    ),
    "strategy.get_strategy_workflow_draft": (
        get_strategy_workflow_draft,
        ToolAuthorization.allowed,
    ),
    "strategy.create_strategy": (create_strategy_tool, ToolAuthorization.allowed),
    "strategy.get_strategy_detail": (get_strategy_detail, ToolAuthorization.allowed),
    "strategy.load_strategy_detail": (load_strategy_detail, ToolAuthorization.allowed),
    "strategy.get_strategy_list": (get_strategy_list, ToolAuthorization.allowed),
    "strategy.update_strategy": (update_strategy, ToolAuthorization.need_authorize),
    "strategy.delete_strategy": (delete_strategy_tool, ToolAuthorization.disabled),
    "strategy.workflow.add_node": (strategy_workflow_add_node, ToolAuthorization.allowed),
    "strategy.workflow.remove_node": (strategy_workflow_remove_node, ToolAuthorization.allowed),
    "strategy.workflow.move_node": (strategy_workflow_move_node, ToolAuthorization.allowed),
    "strategy.workflow.set_node_param": (
        strategy_workflow_set_node_param,
        ToolAuthorization.allowed,
    ),
    "strategy.workflow.unset_node_param": (
        strategy_workflow_unset_node_param,
        ToolAuthorization.allowed,
    ),
    "strategy.workflow.connect_nodes": (
        strategy_workflow_connect_nodes,
        ToolAuthorization.allowed,
    ),
    "strategy.workflow.connect_input": (
        strategy_workflow_connect_input,
        ToolAuthorization.allowed,
    ),
    "strategy.workflow.connect_output": (
        strategy_workflow_connect_output,
        ToolAuthorization.allowed,
    ),
    "strategy.workflow.disconnect_link": (
        strategy_workflow_disconnect_link,
        ToolAuthorization.allowed,
    ),
    "strategy.workflow.disconnect_between": (
        strategy_workflow_disconnect_between,
        ToolAuthorization.allowed,
    ),
}
