from __future__ import annotations

from typing import Any

from langchain.tools import ToolRuntime
from workflow.editing import (
    add_node as workflow_add_node,
)
from workflow.editing import (
    connect_nodes as workflow_connect_nodes,
)
from workflow.editing import (
    connect_to_workflow_output as workflow_connect_to_workflow_output,
)
from workflow.editing import (
    connect_workflow_input as workflow_connect_workflow_input,
)
from workflow.editing import (
    disconnect_link as workflow_disconnect_link,
)
from workflow.editing import (
    move_node as workflow_move_node,
)
from workflow.editing import (
    remove_node as workflow_remove_node,
)
from workflow.editing import (
    set_node_param as workflow_set_node_param,
)
from workflow.editing import (
    unset_node_param as workflow_unset_node_param,
)
from workflow.schemas import WorkflowGraphPersisted

from app.packages.nodes.controller import build_workflow_node_for_graph
from app.packages.strategy.schemas import (
    StrategyCreate,
    StrategyPatch,
    StrategyWorkflowConnectNodesOp,
    StrategyWorkflowMoveNodeOp,
    StrategyWorkflowSetNodeParamOp,
    StrategyWorkflowUnsetNodeParamOp,
)
from app.packages.tool.models import ToolAuthorization
from app.packages.tool.safe_tool import safe_tool

from . import controller
from .draft import (
    clear_workflow_draft,
    draft_is_dirty,
    draft_strategy_id,
    mutate_workflow_draft,
    require_workflow_draft,
    require_workflow_draft_record,
    save_workflow_draft_to_store,
    workflow_draft_namespace,
)


@safe_tool("get_strategy_workflow_template_tool", parse_docstring=True)
async def get_strategy_workflow_template_tool(runtime: ToolRuntime) -> dict[str, Any]:
    """
    加载策略工作流模板到当前会话的工作流草稿中。

    将工作流模板加载到草稿，用于初始化策略编辑结构；这会覆盖当前草稿。

    Args:
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。

    Returns:
        工作流模板（用于写入草稿的 workflow 图结构）。
    """
    store = runtime.store
    if store is None:
        raise ValueError("当前运行时未配置 store，无法读取 workflowDraft")

    existing_item = await store.aget(workflow_draft_namespace(runtime), "workflowDraft")
    existing_record = (
        existing_item.value if existing_item and isinstance(existing_item.value, dict) else {}
    )
    if existing_record.get("workflow") is not None:
        raise ValueError("当前会话已存在 workflowDraft，请先清除草稿后再加载模板")

    template = controller.get_strategy_workflow_template()
    await save_workflow_draft_to_store(
        runtime,
        WorkflowGraphPersisted.model_validate(template),
        strategy_id=None,
        is_dirty=True,
    )
    return template


@safe_tool("get_strategy_node_catalog", parse_docstring=True)
def get_strategy_node_catalog() -> list[dict[str, Any]]:
    """
    列出策略域可用工作流节点。

    返回节点列表与简短说明；如需更具体信息，请再获取节点详情。

    Returns:
        策略域可用节点的列表。
    """
    return [item.model_dump() for item in controller.list_strategy_nodes()]


@safe_tool("get_strategy_workflow_draft", parse_docstring=True)
async def get_strategy_workflow_draft(runtime: ToolRuntime) -> dict[str, Any]:
    """
    读取当前会话中正在编辑的工作流草稿。

    草稿中的值为临时值，必须调用创建策略或更新策略工具保存后才会生效。

    Args:
        runtime: 工具运行时上下文，用于读取当前工作流草稿。

    Returns:
        当前草稿内容、绑定的策略 ID（若有）、脏标记及提示信息。
    """
    record = await require_workflow_draft_record(runtime)
    workflow = await require_workflow_draft(runtime)
    dirty = draft_is_dirty(record)
    return {
        "workflow": workflow.model_dump(by_alias=True),
        "strategy_id": draft_strategy_id(record),
        "is_dirty": dirty,
        "msg": "当前草稿未保存" if dirty else "不存在未保存的草稿",
    }


@safe_tool("clear_strategy_workflow_draft", parse_docstring=True)
async def clear_strategy_workflow_draft(runtime: ToolRuntime) -> dict[str, Any]:
    """
    清除当前会话中的工作流草稿。

    清除后若要继续编辑，需要先加载模板或加载策略到草稿。

    Args:
        runtime: 工具运行时上下文，用于清除当前工作流草稿。

    Returns:
        清除结果，包含 `ok` 字段。
    """
    await clear_workflow_draft(runtime)
    return {"ok": True}


@safe_tool("create_strategy_tool", parse_docstring=True)
async def create_strategy_tool(name: str, description: str, runtime: ToolRuntime) -> dict[str, Any]:
    """
    创建并保存策略。

    使用当前工作流草稿创建策略并返回策略详情；任何新策略都必须调用本工具才会生效。

    Args:
        name: 策略名称。
        description: 策略描述。
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。

    Returns:
        创建后的策略详情（包含 `review` 字段）。
    """
    try:
        record = await require_workflow_draft_record(runtime)
        if draft_strategy_id(record):
            raise ValueError("当前草稿已绑定现有策略，请使用更新策略工具保存修改")

        workflow = await require_workflow_draft(runtime)
        # review = review_strategy_workflow_with_llm(
        #     name=name,
        #     description=description,
        #     workflow=workflow,
        # )
        strategy = controller.create_strategy(
            StrategyCreate(name=name, description=description, workflow=workflow)
        )
        strategy_id = (
            strategy.get("id") if isinstance(strategy, dict) else getattr(strategy, "id", None)
        )
        await save_workflow_draft_to_store(
            runtime,
            workflow,
            strategy_id=str(strategy_id) if strategy_id else None,
            is_dirty=False,
        )
        return dict(strategy) if isinstance(strategy, dict) else strategy.model_dump()
    except Exception as e:
        raise ValueError(f"创建失败：{e}") from e


@safe_tool("get_strategy_detail", parse_docstring=True)
def get_strategy_detail(strategy_id: str) -> dict[str, Any]:
    """
    查询单个策略详情。

    Args:
        strategy_id: 策略 ID；不存在将抛错。

    Returns:
        指定策略的完整详情。
    """
    return controller.get_strategy(strategy_id)


@safe_tool("load_strategy_detail", parse_docstring=True)
async def load_strategy_detail(strategy_id: str, runtime: ToolRuntime) -> dict[str, Any]:
    """
    加载策略以便编辑。

    将指定策略的工作流加载到草稿中用于修改；这会覆盖当前草稿。

    Args:
        strategy_id: 需要加载的策略 ID；不存在将抛错。
        runtime: 工具运行时上下文，用于写入工作流草稿。

    Returns:
        策略详情（包含 workflow 等字段）。
    """
    store = runtime.store
    if store is None:
        raise ValueError("当前运行时未配置 store，无法读取 workflowDraft")

    existing_item = await store.aget(workflow_draft_namespace(runtime), "workflowDraft")
    existing_record = (
        existing_item.value if existing_item and isinstance(existing_item.value, dict) else {}
    )
    if existing_record.get("workflow") is not None:
        raise ValueError("当前会话存在未保存的草稿，请先清除草稿后再加载策略")

    strategy = controller.get_strategy(strategy_id)
    if strategy is None:
        raise ValueError(f"策略不存在: {strategy_id}")

    if isinstance(strategy, dict):
        workflow_raw = strategy.get("workflow")
    else:
        workflow_raw = getattr(strategy, "workflow", None)
    if workflow_raw is None:
        raise ValueError(f"策略缺少 workflow: {strategy_id}")

    await save_workflow_draft_to_store(
        runtime,
        WorkflowGraphPersisted.model_validate(workflow_raw),
        strategy_id=strategy_id,
        is_dirty=True,
    )
    return strategy


@safe_tool("get_strategy_list", parse_docstring=True)
def get_strategy_list() -> list[dict[str, Any]]:
    """
    查询当前工作区策略列表。

    Returns:
        策略列表，用于选择运行或编辑目标。
    """
    return [i.model_dump() for i in controller.list_strategies()]


@safe_tool("update_strategy", parse_docstring=True)
async def update_strategy(
    strategy_id: str, name: str, description: str, runtime: ToolRuntime
) -> dict[str, Any]:
    """
    更新策略配置并保存。

    使用当前工作流草稿保存并覆盖指定 `strategy_id` 的策略；任何对现有策略的修改都必须调用本工具才会生效。

    Args:
        strategy_id: 要更新的策略 ID（必须与当前草稿绑定的策略一致）。
        name: 更新后的策略名称。
        description: 更新后的策略描述。
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。

    Returns:
        更新后的策略详情（包含 `review` 字段）。
    """
    try:
        record = await require_workflow_draft_record(runtime)
        bound_strategy_id = draft_strategy_id(record)
        if not bound_strategy_id:
            raise ValueError("当前草稿尚未绑定策略，请先创建策略")
        if bound_strategy_id != strategy_id:
            raise ValueError(
                f"当前草稿绑定的策略ID为 {bound_strategy_id}，不能更新其他策略 {strategy_id}"
            )

        workflow = await require_workflow_draft(runtime)
        # review = review_strategy_workflow_with_llm(
        #     strategy_id=strategy_id,
        #     name=name,
        #     description=description,
        #     workflow=workflow,
        # )
        strategy = controller.patch_strategy(
            strategy_id,
            StrategyPatch(name=name, description=description, workflow=workflow),
        )
        await save_workflow_draft_to_store(
            runtime,
            workflow,
            strategy_id=strategy_id,
            is_dirty=False,
        )
        return dict(strategy) if isinstance(strategy, dict) else strategy.model_dump()
    except Exception as e:
        raise ValueError(f"更新失败：{e}") from e


@safe_tool("delete_strategy_tool", parse_docstring=True)
def delete_strategy_tool(strategy_id: str) -> dict[str, Any]:
    """
    删除指定策略。

    Args:
        strategy_id: 要删除的策略 ID。

    Returns:
        删除前的策略记录。
    """
    row = controller.get_strategy(strategy_id)
    controller.delete_strategy(strategy_id)
    return row


@safe_tool("strategy_workflow_add_node", parse_docstring=True)
async def strategy_workflow_add_node(
    runtime: ToolRuntime,
    node_type_ids: list[str],
) -> dict[str, Any]:
    """
    向策略工作流草稿中追加节点（支持批量）。

    Args:
        node_type_ids: 要添加的节点类型 ID 列表。
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。

    Returns:
        - 返回添加的 `node_ids`。
    """
    ids = [str(x).strip() for x in node_type_ids if str(x).strip()]
    if not ids:
        raise ValueError("node_type_ids 不能为空")
    allowed_node_ids = {node.id for node in controller.list_strategy_nodes()}

    def _add_many(
        workflow: WorkflowGraphPersisted,
    ) -> tuple[WorkflowGraphPersisted, dict[str, Any]]:
        out_workflow = workflow
        created: list[str] = []
        for t in ids:
            out_workflow, node_id = workflow_add_node(
                out_workflow,
                t,
                allowed_node_ids=allowed_node_ids,
                build_node_payload=lambda type_id, instance_id: build_workflow_node_for_graph(
                    type_id, instance_id=instance_id
                ),
            )
            created.append(node_id)
        result: dict[str, Any] = {"node_ids": created}
        return out_workflow, result

    return await mutate_workflow_draft(runtime, _add_many)


@safe_tool("strategy_workflow_remove_node", parse_docstring=True)
async def strategy_workflow_remove_node(
    runtime: ToolRuntime,
    node_ids: list[str],
) -> dict[str, Any]:
    """
    批量删除策略工作流草稿中的节点，并自动清理关联连线。

    Args:
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。
        node_ids: 要删除的节点 ID 列表。

    Returns:
        删除结果，包含 `removed_node_ids` 字段。
    """
    ids = [str(x).strip() for x in node_ids if str(x).strip()]
    if not ids:
        raise ValueError("node_ids 不能为空")

    def _remove_many(
        workflow: WorkflowGraphPersisted,
    ) -> tuple[WorkflowGraphPersisted, dict[str, Any]]:
        out_workflow = workflow
        removed: list[str] = []
        for nid in ids:
            out_workflow = workflow_remove_node(out_workflow, nid)
            removed.append(nid)
        return out_workflow, {"removed_node_ids": removed}

    return await mutate_workflow_draft(runtime, _remove_many)


@safe_tool("strategy_workflow_move_node", parse_docstring=True)
async def strategy_workflow_move_node(
    runtime: ToolRuntime,
    moves: list[StrategyWorkflowMoveNodeOp],
) -> dict[str, Any]:
    """
    批量设置节点画布坐标（移动节点）。

    Args:
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。
        moves: 移动节点操作列表；每项包含 `node_id` 与 `pos`。

    Returns:
        移动结果，包含 `moved` 字段（每项包含 node_id 与 pos）。
    """
    normalized = [(item.node_id.strip(), item.pos) for item in moves if item.node_id.strip()]
    if not normalized:
        raise ValueError("moves 不能为空")

    def _move_many(
        workflow: WorkflowGraphPersisted,
    ) -> tuple[WorkflowGraphPersisted, dict[str, Any]]:
        out_workflow = workflow
        moved: list[dict[str, Any]] = []
        for nid, pos in normalized:
            out_workflow = workflow_move_node(out_workflow, nid, pos)
            moved.append({"node_id": nid, "pos": list(pos) if isinstance(pos, tuple) else pos})
        return out_workflow, {"moved": moved}

    return await mutate_workflow_draft(runtime, _move_many)


@safe_tool("strategy_workflow_set_node_param", parse_docstring=True)
async def strategy_workflow_set_node_param(
    runtime: ToolRuntime,
    ops: list[StrategyWorkflowSetNodeParamOp],
) -> dict[str, Any]:
    """
    批量设置节点参数。

    Args:
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。
        ops: 操作列表。每项应是包含 `node_id`、`key`、`value` 的对象。

    Returns:
        设置结果，包含 `updated` 字段（每项包含 node_id 与 key）。
    """
    if not ops:
        raise ValueError("ops 不能为空")

    normalized: list[tuple[str, str, Any]] = []
    for item in ops:
        node_id = item.node_id.strip()
        key = item.key.strip()
        if not node_id:
            raise ValueError("ops.node_id 不能为空")
        if not key:
            raise ValueError("ops.key 不能为空")
        normalized.append((node_id, key, item.value))

    def _set_many(
        workflow: WorkflowGraphPersisted,
    ) -> tuple[WorkflowGraphPersisted, dict[str, Any]]:
        out_workflow = workflow
        updated: list[dict[str, str]] = []
        for node_id, key, value in normalized:
            out_workflow = workflow_set_node_param(out_workflow, node_id, key, value)
            updated.append({"node_id": node_id, "key": key})
        return out_workflow, {"updated": updated}

    return await mutate_workflow_draft(runtime, _set_many)


@safe_tool("strategy_workflow_unset_node_param", parse_docstring=True)
async def strategy_workflow_unset_node_param(
    runtime: ToolRuntime,
    ops: list[StrategyWorkflowUnsetNodeParamOp],
) -> dict[str, Any]:
    """
    批量移除节点参数键。

    Args:
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。
        ops: 操作列表。每项应是包含 `node_id`、`key` 的对象。

    Returns:
        移除结果，包含 `removed` 字段（每项包含 node_id 与 key）。
    """
    if not ops:
        raise ValueError("ops 不能为空")

    normalized: list[tuple[str, str]] = []
    for item in ops:
        node_id = item.node_id.strip()
        key = item.key.strip()
        if not node_id:
            raise ValueError("ops.node_id 不能为空")
        if not key:
            raise ValueError("ops.key 不能为空")
        normalized.append((node_id, key))

    def _unset_many(
        workflow: WorkflowGraphPersisted,
    ) -> tuple[WorkflowGraphPersisted, dict[str, Any]]:
        out_workflow = workflow
        removed: list[dict[str, str]] = []
        for node_id, key in normalized:
            out_workflow = workflow_unset_node_param(out_workflow, node_id, key)
            removed.append({"node_id": node_id, "key": key})
        return out_workflow, {"removed": removed}

    return await mutate_workflow_draft(runtime, _unset_many)


@safe_tool("strategy_workflow_connect_nodes", parse_docstring=True)
async def strategy_workflow_connect_nodes(
    runtime: ToolRuntime,
    links: list[StrategyWorkflowConnectNodesOp],
) -> dict[str, Any]:
    """
    批量在策略工作流草稿中创建节点到节点的连线。

    支持 `value_type` 使用逗号分隔多个类型；两端只要有任意一个类型匹配即可连接。

    Args:
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。
        links: 连线列表。每项应是包含 `from_node_id`、`from_socket_name`、`to_node_id`、`to_socket_name` 的对象。

    Returns:
        包含 `link_ids` 字段的新建连线信息。
    """
    if not links:
        raise ValueError("links 不能为空")

    normalized: list[tuple[str, str, str, str]] = []
    for item in links:
        from_node_id = item.from_node_id.strip()
        from_socket_name = item.from_socket_name.strip()
        to_node_id = item.to_node_id.strip()
        to_socket_name = item.to_socket_name.strip()
        if not from_node_id:
            raise ValueError("links.from_node_id 不能为空")
        if not from_socket_name:
            raise ValueError("links.from_socket_name 不能为空")
        if not to_node_id:
            raise ValueError("links.to_node_id 不能为空")
        if not to_socket_name:
            raise ValueError("links.to_socket_name 不能为空")
        normalized.append((from_node_id, from_socket_name, to_node_id, to_socket_name))

    def _connect_many(
        workflow: WorkflowGraphPersisted,
    ) -> tuple[WorkflowGraphPersisted, dict[str, Any]]:
        out_workflow = workflow
        created: list[str] = []
        for from_node_id, from_socket_name, to_node_id, to_socket_name in normalized:
            out_workflow, link_id = workflow_connect_nodes(
                out_workflow, from_node_id, from_socket_name, to_node_id, to_socket_name
            )
            created.append(link_id)
        return out_workflow, {"link_ids": created}

    return await mutate_workflow_draft(runtime, _connect_many)


@safe_tool("strategy_workflow_connect_input", parse_docstring=True)
async def strategy_workflow_connect_input(
    input_socket: str,
    to_node_id: str,
    to_socket: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    """
    创建 `workflow_input` 到节点输入的连线。

    注意：支持 `value_type` 逗号分隔多个类型；两端任意类型匹配即可连接。

    Args:
        input_socket: 工作流输入 socket 名称。
        to_node_id: 终点节点 ID。
        to_socket: 终点节点输入 socket 名称。
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。

    Returns:
        包含 `link_id` 字段的新建连线信息。
    """
    return await mutate_workflow_draft(
        runtime,
        lambda workflow: (
            lambda out_workflow, created_link_id: (
                out_workflow,
                {"link_id": created_link_id},
            )
        )(*workflow_connect_workflow_input(workflow, input_socket, to_node_id, to_socket)),
    )


@safe_tool("strategy_workflow_connect_output", parse_docstring=True)
async def strategy_workflow_connect_output(
    from_node_id: str,
    from_socket: str,
    output_socket: str,
    runtime: ToolRuntime,
) -> dict[str, Any]:
    """
    创建节点输出到 `workflow_output` 的连线。

    注意：支持 `value_type` 逗号分隔多个类型；两端任意类型匹配即可连接。

    Args:
        from_node_id: 起点节点 ID。
        from_socket: 起点节点输出 socket 名称。
        output_socket: 工作流输出 socket 名称。
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。

    Returns:
        包含 `link_id` 字段的新建连线信息。
    """
    return await mutate_workflow_draft(
        runtime,
        lambda workflow: (
            lambda out_workflow, created_link_id: (
                out_workflow,
                {"link_id": created_link_id},
            )
        )(*workflow_connect_to_workflow_output(workflow, from_node_id, from_socket, output_socket)),
    )


@safe_tool("strategy_workflow_disconnect_link", parse_docstring=True)
async def strategy_workflow_disconnect_link(
    runtime: ToolRuntime,
    link_ids: list[str],
) -> dict[str, Any]:
    """
    批量按 `link_id` 删除连线。

    Args:
        runtime: 工具运行时上下文，用于读取并更新当前工作流草稿。
        link_ids: 要删除的连线 ID 列表。

    Returns:
        删除结果，包含 `deleted_link_ids` 字段。
    """
    ids = [str(x).strip() for x in link_ids if str(x).strip()]
    if not ids:
        raise ValueError("link_ids 不能为空")

    def _disconnect_many(
        workflow: WorkflowGraphPersisted,
    ) -> tuple[WorkflowGraphPersisted, dict[str, Any]]:
        out_workflow = workflow
        deleted: list[str] = []
        for lid in ids:
            out_workflow = workflow_disconnect_link(out_workflow, lid)
            deleted.append(lid)
        return out_workflow, {"deleted_link_ids": deleted}

    return await mutate_workflow_draft(runtime, _disconnect_many)


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
    "strategy.clear_strategy_workflow_draft": (
        clear_strategy_workflow_draft,
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
}
