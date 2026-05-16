from __future__ import annotations

import os
import sys
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import TypeVar

import baostock as bs
from pydantic import BaseModel, Field, model_validator

from .loaders import API_DEFAULT_ASSET_COLUMNS, API_DEFAULT_DATE_COLUMNS, DEFAULT_API_NAME

_bs_logged_in = False
_BS_THREAD_LOCK = threading.RLock()
_T = TypeVar("_T")

BAOSTOCK_IO_BUSY_MESSAGE = "BaoStock 正在拉取数据（例如数据同步任务），请稍后再试「测试连接」。"


class BaostockIOBusyError(RuntimeError):
    """无法立即获取 BaoStock 全局 IO 锁（通常表示另有任务正在拉数）。"""

    def __init__(self, message: str = BAOSTOCK_IO_BUSY_MESSAGE) -> None:
        super().__init__(message)


def _baostock_lock_path() -> Path:
    env = os.environ.get("QUANT_AGENT_WORKSPACE")
    root = Path(env).expanduser() if env else Path.home() / ".quant-agent"
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


@contextmanager
def baostock_io_lock(*, blocking: bool = True) -> Iterator[None]:
    """
    串行化 BaoStock 的 socket 访问（同进程多线程 + API 与 scheduler 子进程）。

    列探测 / list_columns 不应持有此锁；仅真实拉数或 verify 时使用。
    blocking=False 时若锁被占用则抛出 BaostockIOBusyError（用于测试连接快速失败）。
    """
    with _BS_THREAD_LOCK:
        path = _baostock_lock_path()
        with open(path, "a+b") as fd:
            if blocking:
                while not _try_acquire_baostock_file_lock(fd):
                    time.sleep(0.15)
            elif not _try_acquire_baostock_file_lock(fd):
                raise BaostockIOBusyError()
            try:
                yield
            finally:
                _release_baostock_file_lock(fd)


def bs_session():
    global _bs_logged_in
    if not _bs_logged_in:
        lg = bs.login()
        if str(lg.error_code) != "0":
            raise ValueError(f"baostock 登录失败: {lg.error_msg}")
        _bs_logged_in = True
    return bs


def run_baostock_io(fn: Callable[[], _T], *, blocking: bool = True) -> _T:
    """在全局 BaoStock IO 锁内登录并执行 fn（用于 load_frame / verify）。"""
    with baostock_io_lock(blocking=blocking):
        bs_session()
        return fn()


class BaoStockConnectionConfig(BaseModel):
    """接口与各 API 专有参数（存储 ``connection`` 段）。"""

    model_config = {"extra": "allow"}

    api_name: str = DEFAULT_API_NAME

    @model_validator(mode="after")
    def _validate(self) -> BaoStockConnectionConfig:
        self.api_name = str(self.api_name).strip()
        if not self.api_name:
            raise ValueError("api_name 不能为空")
        if self.api_name not in API_DEFAULT_DATE_COLUMNS:
            raise ValueError(f"api_name 不在支持列表中: {self.api_name}")
        return self


class BaoStockColumnsConfig(BaseModel):
    """日期列、资产列与列缓存（存储 ``columns`` 段）；须与 connection 的 api_name 一致。"""

    api_name: str = DEFAULT_API_NAME
    date_column: str = API_DEFAULT_DATE_COLUMNS.get(DEFAULT_API_NAME, "date")
    asset_column: str | None = API_DEFAULT_ASSET_COLUMNS.get(DEFAULT_API_NAME)
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> BaoStockColumnsConfig:
        self.api_name = str(self.api_name).strip()
        if not self.api_name:
            raise ValueError("api_name 不能为空")
        if self.api_name not in API_DEFAULT_DATE_COLUMNS:
            raise ValueError(f"api_name 不在支持列表中: {self.api_name}")
        self.date_column = str(self.date_column).strip()
        if not self.date_column:
            raise ValueError("date_column 不能为空")
        if self.asset_column is not None:
            asset_col = str(self.asset_column).strip()
            self.asset_column = asset_col or None
        self.columns = [str(c).strip() for c in self.columns if str(c).strip()]
        return self
