from __future__ import annotations

import functools
import inspect
import os
import sys
import threading
from collections.abc import Callable
from contextlib import ExitStack
from pathlib import Path
from typing import Any

import baostock as bs

_bs_logged_in = False
_BS_THREAD_LOCK = threading.RLock()

BAOSTOCK_IO_BUSY_MESSAGE = "BaoStock 正在拉取数据（例如数据同步任务），请稍后再试「测试连接」。"


class BaostockIOBusyError(RuntimeError):
    """无法立即获取 BaoStock 全局 IO 锁（通常表示另有任务正在拉数）。"""

    def __init__(self, message: str = BAOSTOCK_IO_BUSY_MESSAGE) -> None:
        super().__init__(message)


def _baostock_lock_path() -> Path:
    env = os.environ.get("A_LIANG_UI_WORKSPACE")
    root = Path(env).expanduser() if env else Path.home() / ".a-liang-ui"
    root.mkdir(parents=True, exist_ok=True)
    return root / "baostock.io.lock"


def _try_acquire_baostock_file_lock(fd) -> bool:
    if sys.platform == "win32":
        import msvcrt

        try:
            fd.seek(0)
            msvcrt.locking(fd.fileno(), msvcrt.LK_NBLCK, 1)
            return True
        except OSError:
            return False
    import fcntl

    try:
        fcntl.flock(fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except BlockingIOError:
        return False


def _release_baostock_file_lock(fd) -> None:
    if sys.platform == "win32":
        import msvcrt

        fd.seek(0)
        msvcrt.locking(fd.fileno(), msvcrt.LK_UNLCK, 1)
        return
    import fcntl

    fcntl.flock(fd.fileno(), fcntl.LOCK_UN)


def _ensure_bs_login() -> None:
    global _bs_logged_in
    if _bs_logged_in:
        return
    lg = bs.login()
    if str(lg.error_code) != "0":
        raise ValueError(f"baostock 登录失败: {lg.error_msg}")
    _bs_logged_in = True


class BaostockSession:
    """
    串行化 BaoStock 的 socket 访问并确保已登录。

    进入 ``with`` 块时按序：获取进程内 RLock → 打开锁文件 → 获取跨进程文件锁 → 登录；
    离开时按 LIFO 释放（文件锁 → 关闭 fd → 线程锁）。

    列探测 / list_columns 不应在此 session 内进行；仅真实拉数或 verify 时使用。
    若跨进程文件锁被占用则立即抛出 BaostockIOBusyError。
    """

    __slots__ = ("_stack",)

    def __init__(self) -> None:
        self._stack: ExitStack | None = None

    def __enter__(self) -> BaostockSession:
        stack = ExitStack()
        try:
            stack.enter_context(_BS_THREAD_LOCK)
            fd = stack.enter_context(open(_baostock_lock_path(), "a+b"))
            if not _try_acquire_baostock_file_lock(fd):
                raise BaostockIOBusyError()
            stack.callback(_release_baostock_file_lock, fd)
            _ensure_bs_login()
        except BaseException:
            stack.close()
            raise
        self._stack = stack
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        stack, self._stack = self._stack, None
        if stack is not None:
            stack.close()


def baostock_session(
    fn: Callable[..., Any] | None = None,
) -> Any:
    """
    装饰器：确保被装饰函数运行在 BaostockSession 内。

    用法::

        @baostock_session
        def load_frame(self, *, columns, ...): ...

    调用时可传 ``session=<已激活的 BaostockSession>`` kwarg 复用现有 session，跳过新建。
    若被装饰函数的签名包含 ``session`` 参数，装饰器在新建 session 时会注入 ``session=<实例>``，
    便于在 session 内继续调用其他 ``@baostock_session`` 方法并复用同一锁。
    """

    def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
        accepts_session = "session" in inspect.signature(f).parameters

        @functools.wraps(f)
        def wrapper(
            *args: Any,
            session: BaostockSession | None = None,
            **kwargs: Any,
        ) -> Any:
            if session is not None:
                if accepts_session:
                    return f(*args, session=session, **kwargs)
                return f(*args, **kwargs)
            with BaostockSession() as active:
                if accepts_session:
                    return f(*args, session=active, **kwargs)
                return f(*args, **kwargs)

        return wrapper

    return decorator(fn) if fn is not None else decorator
