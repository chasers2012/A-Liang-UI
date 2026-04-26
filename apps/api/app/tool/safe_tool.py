from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from langchain_core.tools import tool
from langchain_core.tools.base import ToolException


def safe_tool(*tool_args: Any, **tool_kwargs: Any) -> Callable[[Callable[..., Any]], Any] | Any:
    """Wrap `@tool` with safe error handling defaults."""

    def _build(func: Callable[..., Any]) -> Any:
        @wraps(func)
        def _wrapped(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except ToolException:
                raise
            except Exception as e:
                raise ToolException(str(e)) from e

        tool_obj = tool(*tool_args, **tool_kwargs)(_wrapped)
        if hasattr(tool_obj, "handle_tool_error"):
            tool_obj.handle_tool_error = True
        return tool_obj

    if len(tool_args) == 1 and callable(tool_args[0]) and not tool_kwargs:
        func = tool_args[0]
        tool_args = ()
        return _build(func)
    return _build
