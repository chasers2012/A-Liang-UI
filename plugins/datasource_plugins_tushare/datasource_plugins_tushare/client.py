from __future__ import annotations

import os
import sys
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any, TypeVar

import pandas as pd
import tushare as ts

_T = TypeVar("_T")
_TS_THREAD_LOCK = threading.RLock()
_pro_cache: dict[str, object] = {}

TUSHARE_IO_BUSY_MESSAGE = "Tushare 正在拉取数据（例如数据同步任务），请稍后再试「测试连接」。"


class TushareIOBusyError(RuntimeError):
    def __init__(self, message: str = TUSHARE_IO_BUSY_MESSAGE) -> None:
        super().__init__(message)


def resolve_token(token: str | None) -> str:
    value = str(token or "").strip()
    if value:
        return value
    env = os.environ.get("TUSHARE_TOKEN", "").strip()
    if env:
        return env
    raise ValueError("Tushare Token 未配置（请在连接中填写或设置环境变量 TUSHARE_TOKEN）")


def get_pro_api(token: str | None):
    key = resolve_token(token)
    cached = _pro_cache.get(key)
    if cached is not None:
        return cached
    pro = ts.pro_api(key)
    _pro_cache[key] = pro
    return pro


def call_pro(token: str | None, api_name: str, **kwargs: Any) -> pd.DataFrame:
    pro = get_pro_api(resolve_token(token))
    fn = getattr(pro, api_name, None)
    if fn is None or not callable(fn):
        raise ValueError(f"Tushare 未找到接口: {api_name}")
    df = fn(**kwargs)
    if df is None:
        return pd.DataFrame()
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame(df)
    return df


def _lock_path() -> Path:
    env = os.environ.get("A_LIANG_UI_WORKSPACE")
    root = Path(env).expanduser() if env else Path.home() / ".a-liang-ui"
    root.mkdir(parents=True, exist_ok=True)
    return root / "tushare.io.lock"


def _try_acquire_file_lock(fd) -> bool:
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


def _release_file_lock(fd) -> None:
    if sys.platform == "win32":
        import msvcrt

        fd.seek(0)
        msvcrt.locking(fd.fileno(), msvcrt.LK_UNLCK, 1)
        return
    import fcntl

    fcntl.flock(fd.fileno(), fcntl.LOCK_UN)


@contextmanager
def tushare_io_lock(*, blocking: bool = True) -> Iterator[None]:
    with _TS_THREAD_LOCK:
        path = _lock_path()
        with open(path, "a+b") as fd:
            if blocking:
                while not _try_acquire_file_lock(fd):
                    time.sleep(0.15)
            elif not _try_acquire_file_lock(fd):
                raise TushareIOBusyError()
            try:
                yield
            finally:
                _release_file_lock(fd)


def run_tushare_io(fn: Callable[[], _T], *, blocking: bool = True) -> _T:
    with tushare_io_lock(blocking=blocking):
        return fn()
