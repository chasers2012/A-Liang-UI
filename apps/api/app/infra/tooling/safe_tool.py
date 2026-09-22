"""LangChain @tool safe wrapper utilities."""

from __future__ import annotations

import inspect
from collections.abc import Callable
from functools import wraps
from typing import Any

from langchain_core.tools import tool
from langchain_core.tools.base import ToolException


def _raise_tool_exception(error: Exception) -> None:
    if isinstance(error, ToolException):
        raise error
    raise ToolException(str(error)) from error


def _wrap_async_tool(func: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(func)
    async def _wrapped(*args: Any, **kwargs: Any) -> Any:
        try:
            return await func(*args, **kwargs)
        except Exception as error:
            _raise_tool_exception(error)

    return _wrapped


def _wrap_sync_tool(func: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(func)
    def _wrapped(*args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except Exception as error:
            _raise_tool_exception(error)

    return _wrapped


def safe_tool(*tool_args: Any, **tool_kwargs: Any) -> Callable[[Callable[..., Any]], Any] | Any:
    """Wrap ``@tool`` with safe error handling defaults."""

    def _build(func: Callable[..., Any]) -> Any:
        _wrapped = (
            _wrap_async_tool(func) if inspect.iscoroutinefunction(func) else _wrap_sync_tool(func)
        )
        tool_obj = tool(*tool_args, **tool_kwargs)(_wrapped)
        if hasattr(tool_obj, "handle_tool_error"):
            tool_obj.handle_tool_error = True
        return tool_obj

    if len(tool_args) == 1 and callable(tool_args[0]) and not tool_kwargs:
        func = tool_args[0]
        tool_args = ()
        return _build(func)
    return _build
