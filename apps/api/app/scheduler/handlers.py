from __future__ import annotations

from collections.abc import Callable
from typing import Any

TaskHandler = Callable[[dict[str, Any]], Any]

_HANDLERS: dict[str, TaskHandler] = {}


def register_task_handler(task_type: str, handler: TaskHandler) -> None:
    if not task_type.strip():
        raise ValueError("task_type 不能为空")
    _HANDLERS[task_type] = handler


def get_task_handler(task_type: str) -> TaskHandler | None:
    return _HANDLERS.get(task_type)


def run_task_handler(task_type: str, payload: dict[str, Any]) -> Any:
    handler = get_task_handler(task_type)
    if handler is None:
        raise ValueError(f"未注册任务处理器: {task_type}")
    return handler(payload)


def list_task_types() -> list[str]:
    return sorted(_HANDLERS.keys())
