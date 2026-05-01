from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from langchain.tools import ToolRuntime
from workflow.schemas import WorkflowGraphPersisted

WORKFLOW_DRAFT_STORE_LOCK = asyncio.Lock()


def get_runtime_thread_id(runtime: ToolRuntime) -> str:
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


def workflow_draft_namespace(runtime: ToolRuntime) -> tuple[str, ...]:
    return ("strategy", "workflowDraft", get_runtime_thread_id(runtime))


async def load_workflow_draft_record_from_store(runtime: ToolRuntime) -> dict[str, Any]:
    store = runtime.store
    if store is None:
        raise ValueError("当前运行时未配置 store，无法读取 workflowDraft")
    item = await store.aget(workflow_draft_namespace(runtime), "workflowDraft")
    record = item.value if item and isinstance(item.value, dict) else {}
    raw = record.get("workflow")
    if raw is None:
        raise ValueError("缺少 workflowDraft，请先在会话上下文中初始化策略工作流草稿")
    return record


async def load_workflow_draft_from_store(runtime: ToolRuntime) -> WorkflowGraphPersisted:
    record = await load_workflow_draft_record_from_store(runtime)
    raw = record.get("workflow")
    if isinstance(raw, WorkflowGraphPersisted):
        return raw
    return WorkflowGraphPersisted.model_validate(raw)


async def save_workflow_draft_to_store(
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
        workflow_draft_namespace(runtime),
        "workflowDraft",
        {
            "workflow": workflow.model_dump(by_alias=True),
            "strategy_id": strategy_id,
            "is_dirty": is_dirty,
        },
    )


async def require_workflow_draft_record(runtime: ToolRuntime) -> dict[str, Any]:
    async with WORKFLOW_DRAFT_STORE_LOCK:
        return await load_workflow_draft_record_from_store(runtime)


def draft_strategy_id(record: dict[str, Any]) -> str | None:
    raw = record.get("strategy_id")
    return str(raw) if raw else None


def draft_is_dirty(record: dict[str, Any]) -> bool:
    return bool(record.get("is_dirty", False))


async def mutate_workflow_draft(
    runtime: ToolRuntime,
    mutator: Callable[[WorkflowGraphPersisted], tuple[WorkflowGraphPersisted, dict[str, Any]]],
) -> dict[str, Any]:
    async with WORKFLOW_DRAFT_STORE_LOCK:
        record = await load_workflow_draft_record_from_store(runtime)
        workflow_raw = record.get("workflow")
        workflow = (
            workflow_raw
            if isinstance(workflow_raw, WorkflowGraphPersisted)
            else WorkflowGraphPersisted.model_validate(workflow_raw)
        )
        out_workflow, result = mutator(workflow)
        await save_workflow_draft_to_store(
            runtime,
            out_workflow,
            strategy_id=draft_strategy_id(record),
            is_dirty=True,
        )
    return result


async def require_workflow_draft(runtime: ToolRuntime) -> WorkflowGraphPersisted:
    async with WORKFLOW_DRAFT_STORE_LOCK:
        return await load_workflow_draft_from_store(runtime)


async def set_workflow_draft(runtime: ToolRuntime, workflow: WorkflowGraphPersisted) -> None:
    async with WORKFLOW_DRAFT_STORE_LOCK:
        await save_workflow_draft_to_store(runtime, workflow)


async def clear_workflow_draft(runtime: ToolRuntime) -> None:
    async with WORKFLOW_DRAFT_STORE_LOCK:
        store = runtime.store
        if store is None:
            raise ValueError("当前运行时未配置 store，无法清除 workflowDraft")
        await store.aput(workflow_draft_namespace(runtime), "workflowDraft", {})
