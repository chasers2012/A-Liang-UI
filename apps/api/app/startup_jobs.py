from __future__ import annotations

from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, TypeVar, overload

StartupJob = Callable[[], Any] | Callable[[], Awaitable[Any]]

STARTUP_JOBS: list[StartupJob] = []

_F = TypeVar("_F", bound=StartupJob)

_FIRST_RUN_CACHE: bool | None = None


@overload
def register_startup_job(func: _F, *, replace: bool = False) -> _F: ...


@overload
def register_startup_job(*, replace: bool = False) -> Callable[[_F], _F]: ...


def register_startup_job(
    func: _F | None = None,
    *,
    replace: bool = False,
) -> _F | Callable[[_F], _F]:
    """
    Register a callable to be executed on application startup.

    Supports both usages:
    - @register_startup_job
    - @register_startup_job(replace=True)

    Args:
        func: The job function (sync or async) taking no arguments.
        replace: If True, replace an existing registration of the same function.
    """

    def _add(f: _F) -> _F:
        if replace:
            for i, existing in enumerate(STARTUP_JOBS):
                if existing is f:
                    STARTUP_JOBS[i] = f
                    return f
        STARTUP_JOBS.append(f)
        return f

    if func is None:
        return _add

    return _add(func)


def is_first_run() -> bool:
    global _FIRST_RUN_CACHE
    if _FIRST_RUN_CACHE is not None:
        return _FIRST_RUN_CACHE

    workspace_root = Path(__file__).resolve().parents[3]
    flag_path = workspace_root / ".quant-agent" / "first_run.flag"
    flag_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Atomic "create-if-not-exists". Safe under concurrent startups.
        flag_path.open("x", encoding="utf-8").close()
        _FIRST_RUN_CACHE = True
        return _FIRST_RUN_CACHE
    except FileExistsError:
        _FIRST_RUN_CACHE = False
        return _FIRST_RUN_CACHE
