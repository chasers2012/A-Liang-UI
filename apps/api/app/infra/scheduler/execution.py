from __future__ import annotations

import ctypes
import logging
import multiprocessing
import os
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any, TypeVar

from .exceptions import JobCancelledError

logger = logging.getLogger(__name__)

_REGISTRY_LOCK = threading.Lock()
_RUNNING_THREADS: dict[str, threading.Thread] = {}
_RUNNING_PROCS: dict[str, multiprocessing.Process] = {}

T = TypeVar("T")


def _use_process_isolation() -> bool:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return False
    return os.getenv("SCHEDULER_JOB_ISOLATED", "1").lower() not in {"0", "false", "no"}


def _bootstrap_child_env() -> None:
    app_root = Path(__file__).resolve().parents[2]
    repo_root = Path(__file__).resolve().parents[3]
    for candidate in (
        app_root / ".env.local",
        repo_root / ".env.local",
        app_root / ".env.example",
        repo_root / ".env.example",
    ):
        if not candidate.is_file():
            continue
        for raw_line in candidate.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ.setdefault(key, value)


def _bootstrap_child_runtime() -> None:
    from app.packages.plugin.registry import PluginRegistry, load_plugins_from_entry_points
    from .handlers import bootstrap_task_handlers

    try:
        load_plugins_from_entry_points(PluginRegistry.instance())
    except Exception:
        logger.exception("plugin discovery failed in isolated job process")
    bootstrap_task_handlers()


def _isolated_job_entry(
    task_type: str,
    payload: dict[str, object],
    result_queue: multiprocessing.Queue,
) -> None:
    try:
        _bootstrap_child_env()
        _bootstrap_child_runtime()
        from .handlers import run_task_handler

        result = run_task_handler(task_type, payload)
        result_queue.put(("ok", result))
    except JobCancelledError as exc:
        result_queue.put(("err", str(exc), JobCancelledError.__name__))
    except BaseException as exc:
        result_queue.put(("err", str(exc), type(exc).__name__))


def _async_raise(thread_id: int, exception: type[BaseException]) -> None:
    if not issubclass(exception, BaseException):
        raise TypeError("exception must be a BaseException subclass")
    n = ctypes.pythonapi.PyThreadState_SetAsyncExc(
        ctypes.c_ulong(thread_id),
        ctypes.py_object(exception),
    )
    if n == 0:
        raise ValueError(f"invalid thread id: {thread_id}")
    if n > 1:
        ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_ulong(thread_id), None)
        raise RuntimeError("PyThreadState_SetAsyncExc failed")


def register_running_job(job_id: str, thread: threading.Thread) -> None:
    with _REGISTRY_LOCK:
        _RUNNING_THREADS[job_id] = thread


def unregister_running_job(job_id: str) -> None:
    with _REGISTRY_LOCK:
        _RUNNING_THREADS.pop(job_id, None)


def register_running_process(job_id: str, proc: multiprocessing.Process) -> None:
    with _REGISTRY_LOCK:
        _RUNNING_PROCS[job_id] = proc


def unregister_running_process(job_id: str) -> None:
    with _REGISTRY_LOCK:
        _RUNNING_PROCS.pop(job_id, None)


def _terminate_running_process(job_id: str, proc: multiprocessing.Process) -> bool:
    if not proc.is_alive():
        return False
    proc.terminate()
    proc.join(timeout=5)
    if proc.is_alive():
        proc.kill()
        proc.join(timeout=2)
    logger.info("terminated job process %s (exitcode=%s)", job_id, proc.exitcode)
    return True


def terminate_running_job(job_id: str) -> bool:
    """Kill a running job (process terminate/kill, or thread async exception)."""
    with _REGISTRY_LOCK:
        proc = _RUNNING_PROCS.get(job_id)
        thread = _RUNNING_THREADS.get(job_id)

    if proc is not None:
        return _terminate_running_process(job_id, proc)

    if thread is None or not thread.is_alive():
        return False
    ident = thread.ident
    if ident is None:
        return False
    try:
        _async_raise(ident, JobCancelledError)
        logger.info("cancel signal sent to job %s (thread=%s)", job_id, ident)
        return True
    except Exception:
        logger.exception("failed to terminate job thread %s", job_id)
        return False


def run_in_cancellable_thread(job_id: str, fn: Callable[[], T]) -> T:
    result: list[T] = []
    exc: list[BaseException] = []

    def _target() -> None:
        try:
            result.append(fn())
        except BaseException as error:
            exc.append(error)

    thread = threading.Thread(target=_target, name=f"scheduler-job-{job_id}", daemon=True)
    register_running_job(job_id, thread)
    try:
        thread.start()
        thread.join()
    finally:
        unregister_running_job(job_id)

    if exc:
        raise exc[0]
    if not result:
        raise RuntimeError(f"job {job_id} finished without result or exception")
    return result[0]


def run_isolated_job(
    job_id: str,
    task_type: str,
    payload: dict[str, object],
) -> Any:
    ctx = multiprocessing.get_context("spawn")
    result_queue: multiprocessing.Queue = ctx.Queue()
    proc = ctx.Process(
        target=_isolated_job_entry,
        args=(task_type, payload, result_queue),
        name=f"scheduler-job-{job_id}",
        daemon=True,
    )
    register_running_process(job_id, proc)
    try:
        proc.start()
        proc.join()
    finally:
        unregister_running_process(job_id)

    if not result_queue.empty():
        status, *rest = result_queue.get_nowait()
        if status == "ok":
            return rest[0]
        err_msg, err_type = rest[0], rest[1]
        if err_type == JobCancelledError.__name__:
            raise JobCancelledError(err_msg)
        raise RuntimeError(err_msg)

    from .controller import is_job_cancelled

    if is_job_cancelled(job_id):
        raise JobCancelledError(f"任务已取消: {job_id}")
    if proc.exitcode not in (0, None):
        raise RuntimeError(f"job process exited unexpectedly (code={proc.exitcode})")
    raise RuntimeError(f"job {job_id} finished without result")


def run_job(
    job_id: str,
    task_type: str,
    payload: dict[str, object],
    fn: Callable[[], T],
) -> T:
    if _use_process_isolation():
        return run_isolated_job(job_id, task_type, payload)
    return run_in_cancellable_thread(job_id, fn)
