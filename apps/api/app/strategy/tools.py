from __future__ import annotations

from threading import RLock
from typing import Any

from langchain.tools import ToolRuntime
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
    update_node_metadata,
)
from app.strategy.schemas import StrategyCreate, StrategyPatch
from app.tool.models import ToolAuthorization
from app.tool.registry import ChatToolRegistry
from app.tool.safe_tool import safe_tool

_WORKFLOW_DRAFT_STORE_LOCK = RLock()


def _require_workflow_draft(runtime: ToolRuntime) -> WorkflowGraphPersisted:
    store = runtime.store
    if store is None:
        raise ValueError("当前运行时未配置 store，无法读取 workflowDraft")
    with _WORKFLOW_DRAFT_STORE_LOCK:
        item = store.get(_workflow_draft_namespace(runtime), "workflowDraft")
    raw = (item.value or {}).get("workflow") if item else None
    if raw is None:
        raise ValueError("缺少 workflowDraft，请先在会话上下文中初始化策略工作流草稿")
    if isinstance(raw, WorkflowGraphPersisted):
        return raw
    return WorkflowGraphPersisted.model_validate(raw)


def _set_workflow_draft(runtime: ToolRuntime, workflow: WorkflowGraphPersisted) -> None:
    store = runtime.store
    if store is None:
        raise ValueError("当前运行时未配置 store，无法写入 workflowDraft")
    with _WORKFLOW_DRAFT_STORE_LOCK:
        store.put(
            _workflow_draft_namespace(runtime),
            "workflowDraft",
            {"workflow": workflow.model_dump(by_alias=True)},
        )


def _workflow_draft_namespace(runtime: ToolRuntime) -> tuple[str, ...]:
    cfg = runtime.config if isinstance(runtime.config, dict) else {}
    configurable = cfg.get("configurable", {}) if isinstance(cfg, dict) else {}
    thread_id = None
    if isinstance(configurable, dict):
        thread_id = configurable.get("thread_id")
    if not thread_id and isinstance(cfg, dict):
        thread_id = cfg.get("thread_id")
    if not thread_id:
        raise ValueError("缺少 thread_id，无法定位 workflowDraft 存储命名空间")
    return ("strategy", "workflowDraft", str(thread_id))


@safe_tool(
    "加载策略工作流模板",
    description="加载策略工作流模板。\n将工作流模板加载到store, 用于初始化策略编辑结构，后续可基于模板填充节点与连线。",
)
def get_strategy_workflow_template_tool(runtime: ToolRuntime) -> dict[str, Any]:
    template = get_strategy_workflow_template()
    _set_workflow_draft(runtime, WorkflowGraphPersisted.model_validate(template))
    return template


@safe_tool(
    "获取策略可用节点",
    description="列出策略域可用工作流节点。\n返回节点类型定义（含输入/输出端口）用于前端节点选择器。",
)
def get_strategy_node_catalog() -> list[dict[str, Any]]:
    return [item.model_dump() for item in list_strategy_nodes()]


@safe_tool(
    "查看工作流草稿",
    description="读取当前编辑中的工作流草稿。\n返回 store 中的workflowDraft 保存的策略工作流草稿内容。",
)
def get_strategy_workflow_draft(runtime: ToolRuntime) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    return workflow.model_dump(by_alias=True)


@safe_tool(
    "创建策略",
    description="创建并保存策略。\n入参 name、description；使用store中的workflowDraft创建策略并返回创建后的策略详情。",
)
def create_strategy_tool(name: str, description: str, runtime: ToolRuntime) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)

    return create_strategy(StrategyCreate(name=name, description=description, workflow=workflow))


@safe_tool(
    "获取策略详情",
    description="查询单个策略详情。\n获取已存在的策略的完整信息入参 strategy_id；不存在时报错。",
)
def get_strategy_detail(strategy_id: str) -> dict[str, Any]:
    return get_strategy(strategy_id)


@safe_tool(
    "加载策略",
    description="加载策略以便编辑。\n将已存在的策略的工作流加载到store中的workflowDraft以便用于修改，这回覆盖现在的store中的workflowDraft，入参 strategy_id；不存在时报错。",
)
def load_strategy_detail(strategy_id: str, runtime: ToolRuntime) -> dict[str, Any]:
    strategy = get_strategy(strategy_id)
    if strategy is None:
        raise ValueError(f"策略不存在: {strategy_id}")

    if isinstance(strategy, dict):
        workflow_raw = strategy.get("workflow")
    else:
        workflow_raw = getattr(strategy, "workflow", None)
    if workflow_raw is None:
        raise ValueError(f"策略缺少 workflow: {strategy_id}")

    _set_workflow_draft(runtime, WorkflowGraphPersisted.model_validate(workflow_raw))
    return strategy


@safe_tool(
    "获取策略列表",
    description="查询当前工作区策略列表。\n返回策略列表用于选择运行或编辑目标。",
)
def get_strategy_list() -> list[dict[str, Any]]:
    return [i.model_dump() for i in list_strategies()]


@safe_tool(
    "更新策略",
    description="更新策略配置。\n入参 strategy_id、name、description；使用store中的workflowDraft更新策略并返回更新后的策略详情。",
)
def update_strategy(
    strategy_id: str, name: str, description: str, runtime: ToolRuntime
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    return patch_strategy(
        strategy_id,
        StrategyPatch(name=name, description=description, workflow=workflow),
    )


@safe_tool("删除策略", description="删除指定策略。\n入参 strategy_id；返回删除前记录。")
def delete_strategy_tool(strategy_id: str) -> dict[str, Any]:
    row = get_strategy(strategy_id)
    delete_strategy(strategy_id)
    return row


@safe_tool(
    "策略工作流-添加节点",
    description=(
        "向工作流追加指定类型节点。\n"
        "入参 node_type_id 以及可选 metadata（WorkflowGraphNode 字段，如 pos/label/params）；"
        "基于 ToolContext.workflowDraft 更新草稿并返回新节点 node_id。"
    ),
)
def strategy_workflow_add_node(
    node_type_id: str,
    runtime: ToolRuntime,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow, node_id = add_node(workflow, node_type_id, **(metadata or {}))
    _set_workflow_draft(runtime, out_workflow)
    return {"node_id": node_id}


@safe_tool(
    "策略工作流-删除节点",
    description="删除指定节点并自动清理关联连线。\n入参 node_id；基于 ToolContext.workflowDraft 更新草稿。",
)
def strategy_workflow_remove_node(node_id: str, runtime: ToolRuntime) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow = remove_node(workflow, node_id)
    _set_workflow_draft(runtime, out_workflow)
    return {"ok": True}


@safe_tool(
    "策略工作流-更新节点元数据",
    description=(
        "更新节点元信息。\n"
        "入参 node_id、metadata（支持 label/description/category/pos/inputs/outputs/params）；"
        "基于 ToolContext.workflowDraft 更新草稿。"
    ),
)
def strategy_workflow_update_node_metadata(
    node_id: str,
    metadata: dict[str, Any],
    runtime: ToolRuntime,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow = update_node_metadata(workflow, node_id, **metadata)
    _set_workflow_draft(runtime, out_workflow)
    return {"ok": True}


@safe_tool(
    "策略工作流-移动节点",
    description="设置节点画布坐标。\n入参 node_id、pos([x, y])；基于 ToolContext.workflowDraft 更新草稿。",
)
def strategy_workflow_move_node(
    node_id: str,
    pos: list[float] | tuple[float, float],
    runtime: ToolRuntime,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow = move_node(workflow, node_id, pos)
    _set_workflow_draft(runtime, out_workflow)
    return {"ok": True}


@safe_tool(
    "策略工作流-设置节点参数",
    description="设置节点单个参数。\n入参 node_id、key、value；基于 ToolContext.workflowDraft 更新草稿。",
)
def strategy_workflow_set_node_param(
    node_id: str,
    key: str,
    value: Any,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow = set_node_param(workflow, node_id, key, value)
    _set_workflow_draft(runtime, out_workflow)
    return {"ok": True}


@safe_tool(
    "策略工作流-移除节点参数",
    description="移除节点参数键。\n入参 node_id、key；基于 ToolContext.workflowDraft 更新草稿。",
)
def strategy_workflow_unset_node_param(
    node_id: str,
    key: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow = unset_node_param(workflow, node_id, key)
    _set_workflow_draft(runtime, out_workflow)
    return {"ok": True}


@safe_tool(
    "策略工作流-连接节点",
    description=(
        "创建节点到节点连线。\n"
        "入参 from_node_id、from_socket、to_node_id、to_socket，可选 link_id；"
        "基于 ToolContext.workflowDraft 更新草稿并返回 link_id。"
        "注意只有value_type相同的socket才能连接"
    ),
)
def strategy_workflow_connect_nodes(
    from_node_id: str,
    from_socket: str,
    to_node_id: str,
    to_socket: str,
    runtime: ToolRuntime,
    link_id: str | None = None,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow, created_link_id = connect_nodes(
        workflow, from_node_id, from_socket, to_node_id, to_socket, link_id
    )
    _set_workflow_draft(runtime, out_workflow)
    return {"link_id": created_link_id}


@safe_tool(
    "策略工作流-连接工作流输入",
    description=(
        "创建 workflow_input 到节点输入连线。\n"
        "入参 input_socket、to_node_id、to_socket，可选 link_id；"
        "基于 ToolContext.workflowDraft 更新草稿并返回 link_id。"
        "注意只有value_type相同的socket才能连接"
    ),
)
def strategy_workflow_connect_input(
    input_socket: str,
    to_node_id: str,
    to_socket: str,
    runtime: ToolRuntime,
    link_id: str | None = None,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow, created_link_id = connect_workflow_input(
        workflow, input_socket, to_node_id, to_socket, link_id
    )
    _set_workflow_draft(runtime, out_workflow)
    return {"link_id": created_link_id}


@safe_tool(
    "策略工作流-连接工作流输出",
    description=(
        "创建节点输出到 workflow_output 连线。\n"
        "入参 from_node_id、from_socket、output_socket，可选 link_id；"
        "基于 ToolContext.workflowDraft 更新草稿并返回 link_id。"
        "注意只有value_type相同的socket才能连接"
    ),
)
def strategy_workflow_connect_output(
    from_node_id: str,
    from_socket: str,
    output_socket: str,
    runtime: ToolRuntime,
    link_id: str | None = None,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow, created_link_id = connect_to_workflow_output(
        workflow, from_node_id, from_socket, output_socket, link_id
    )
    _set_workflow_draft(runtime, out_workflow)
    return {"link_id": created_link_id}


@safe_tool(
    "策略工作流-按连线ID断开",
    description="按 link_id 删除连线。\n入参 link_id；基于 ToolContext.workflowDraft 更新草稿。",
)
def strategy_workflow_disconnect_link(
    link_id: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow = disconnect_link(workflow, link_id)
    _set_workflow_draft(runtime, out_workflow)
    return {"ok": True}


@safe_tool(
    "策略工作流-按端点断开",
    description=(
        "按起止端点删除 node->node 连线。\n"
        "入参 from_node_id、from_socket、to_node_id、to_socket；基于 ToolContext.workflowDraft 更新草稿。"
    ),
)
def strategy_workflow_disconnect_between(
    from_node_id: str,
    from_socket: str,
    to_node_id: str,
    to_socket: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    workflow = _require_workflow_draft(runtime)
    out_workflow = disconnect_between(workflow, from_node_id, from_socket, to_node_id, to_socket)
    _set_workflow_draft(runtime, out_workflow)
    return {"ok": True}


def register_strategy_chat_tools() -> None:
    tool_defs = [
        (
            "strategy.get_strategy_workflow_template",
            get_strategy_workflow_template_tool,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.get_strategy_node_catalog",
            get_strategy_node_catalog,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.get_strategy_workflow_draft",
            get_strategy_workflow_draft,
            ToolAuthorization.allowed,
        ),
        ("strategy.create_strategy", create_strategy_tool, ToolAuthorization.allowed),
        ("strategy.get_strategy_detail", get_strategy_detail, ToolAuthorization.allowed),
        ("strategy.load_strategy_detail", load_strategy_detail, ToolAuthorization.allowed),
        ("strategy.get_strategy_list", get_strategy_list, ToolAuthorization.allowed),
        ("strategy.update_strategy", update_strategy, ToolAuthorization.need_authorize),
        ("strategy.delete_strategy", delete_strategy_tool, ToolAuthorization.disabled),
        ("strategy.workflow.add_node", strategy_workflow_add_node, ToolAuthorization.allowed),
        ("strategy.workflow.remove_node", strategy_workflow_remove_node, ToolAuthorization.allowed),
        (
            "strategy.workflow.update_node_metadata",
            strategy_workflow_update_node_metadata,
            ToolAuthorization.allowed,
        ),
        ("strategy.workflow.move_node", strategy_workflow_move_node, ToolAuthorization.allowed),
        (
            "strategy.workflow.set_node_param",
            strategy_workflow_set_node_param,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.workflow.unset_node_param",
            strategy_workflow_unset_node_param,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.workflow.connect_nodes",
            strategy_workflow_connect_nodes,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.workflow.connect_input",
            strategy_workflow_connect_input,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.workflow.connect_output",
            strategy_workflow_connect_output,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.workflow.disconnect_link",
            strategy_workflow_disconnect_link,
            ToolAuthorization.allowed,
        ),
        (
            "strategy.workflow.disconnect_between",
            strategy_workflow_disconnect_between,
            ToolAuthorization.allowed,
        ),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="策略",
            authorization=authorization,
        )
