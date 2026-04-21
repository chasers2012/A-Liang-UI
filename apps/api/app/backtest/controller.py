from __future__ import annotations

import csv
import json
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from workspace import get_workspace_root

from app.backtest.models import BacktestRunRow
from app.backtest.registry import BacktestRunsStore
from app.backtest.schemas import BacktestRunDetail, BacktestRunSummary, RunBacktestRequest
from app.data_set.controller import get_data_set, get_data_set_detail
from app.scheduler.controller import enqueue_oneoff_job
from app.scheduler.handlers import register_task_handler
from app.strategy.registry import StrategyRegistry


class BacktestRunNotFoundError(ValueError):
    def __init__(self, run_id: str) -> None:
        super().__init__(f"backtest run 不存在: {run_id}")
        self.run_id = run_id


def _to_summary(row: BacktestRunRow) -> BacktestRunSummary:
    strategy = StrategyRegistry.get_by_id(row.strategy_id)
    data_set = get_data_set_detail(row.data_set_id)
    return BacktestRunSummary(
        id=row.id,
        strategy_id=row.strategy_id,
        strategy_name=strategy.name if strategy is not None else None,
        data_set_id=row.data_set_id,
        data_set_name=data_set.name if data_set is not None else None,
        status=row.status,  # type: ignore[arg-type]
        queued_at=row.queued_at,
        start_at=row.start_at,
        end_at=row.end_at,
        error=row.error,
    )


def _to_detail(row: BacktestRunRow) -> BacktestRunDetail:
    strategy = StrategyRegistry.get_by_id(row.strategy_id)
    data_set = get_data_set_detail(row.data_set_id)
    return BacktestRunDetail(
        id=row.id,
        strategy_id=row.strategy_id,
        strategy_name=strategy.name if strategy is not None else None,
        data_set_id=row.data_set_id,
        data_set_name=data_set.name if data_set is not None else None,
        status=row.status,  # type: ignore[arg-type]
        queued_at=row.queued_at,
        start_at=row.start_at,
        end_at=row.end_at,
        error=row.error,
        results=row.results_path,
    )


def enqueue_backtest_run(body: RunBacktestRequest) -> BacktestRunSummary:
    strategy = StrategyRegistry.get_by_id(body.strategy_id)
    if strategy is None:
        raise ValueError("策略不存在")
    if get_data_set(body.data_set_id) is None:
        raise ValueError("数据集不存在")

    now = datetime.now(timezone.utc)
    row = BacktestRunRow(
        id=uuid4().hex,
        strategy_id=body.strategy_id,
        data_set_id=body.data_set_id,
        status="queued",
        queued_at=now,
        params=body.model_dump(mode="json"),
    )
    created_row = BacktestRunsStore.append(row)
    enqueue_oneoff_job(
        task_type="backtest.run",
        trigger_type="manual",
        payload={"run_id": created_row.id},
        max_retries=0,
        timeout_seconds=3600,
        dedupe_key=f"backtest-run:{created_row.id}",
    )
    return _to_summary(created_row)


def list_backtest_runs(
    *,
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[BacktestRunSummary]:
    return [
        _to_summary(r)
        for r in BacktestRunsStore.list_items(strategy_id=strategy_id, status=status, limit=limit)
    ]


def get_backtest_run(run_id: str) -> BacktestRunDetail:
    row = BacktestRunsStore.get_item(run_id)
    if row is None:
        raise BacktestRunNotFoundError(run_id)

    run = _to_detail(row)
    results_path = run.results
    if not results_path:
        return run

    path = Path(results_path)
    if not path.is_absolute():
        path = Path(get_workspace_root()) / path
    portfolio_path = path / "portfolio.json"
    if portfolio_path.exists():
        with suppress(json.JSONDecodeError):
            return run.model_copy(
                update={"results": json.loads(portfolio_path.read_text(encoding="utf-8"))}
            )
    return run


def get_backtest_node_output(run_id: str, node_id: str) -> dict[str, object]:
    return get_backtest_node_output_page(run_id, node_id, file_name=None, page=1, page_size=100)


def get_backtest_node_output_page(  # noqa: C901
    run_id: str,
    node_id: str,
    *,
    file_name: str | None,
    page: int,
    page_size: int,
) -> dict[str, object]:
    row = BacktestRunsStore.get_item(run_id)
    if row is None:
        raise BacktestRunNotFoundError(run_id)
    if page < 1:
        raise ValueError("page 必须 >= 1")
    if page_size < 1:
        raise ValueError("page_size 必须 >= 1")
    if page_size > 1000:
        raise ValueError("page_size 不能超过 1000")
    if not row.results_path:
        return {"run_id": run_id, "node_id": node_id, "files": []}

    path = Path(row.results_path)
    if not path.is_absolute():
        path = Path(get_workspace_root()) / path
    node_dir = path / node_id
    if not node_dir.exists() or not node_dir.is_dir():
        return {"run_id": run_id, "node_id": node_id, "files": []}

    if file_name:
        target_file = node_dir / file_name
        if not target_file.exists() or not target_file.is_file():
            return {
                "run_id": run_id,
                "node_id": node_id,
                "file": file_name,
                "kind": "missing",
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_rows": 0,
                    "total_pages": 0,
                },
                "headers": [],
                "rows": [],
            }
        if target_file.suffix.lower() == ".csv":
            with target_file.open("r", encoding="utf-8", newline="") as f:
                reader = csv.reader(f)
                try:
                    headers = next(reader)
                except StopIteration:
                    headers = []
                    total_rows = 0
                    rows: list[list[str]] = []
                else:
                    total_rows = 0
                    start = (page - 1) * page_size
                    end = start + page_size
                    rows = []
                    for idx, r in enumerate(reader):
                        if idx >= start and idx < end:
                            rows.append([str(v) for v in r])
                        total_rows += 1
            total_pages = (total_rows + page_size - 1) // page_size if total_rows > 0 else 0
            return {
                "run_id": run_id,
                "node_id": node_id,
                "file": file_name,
                "kind": "csv",
                "headers": [str(h) for h in headers],
                "rows": rows,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_rows": total_rows,
                    "total_pages": total_pages,
                },
            }
        suffix = target_file.suffix.lower()
        if suffix == ".json":
            with suppress(json.JSONDecodeError):
                return {
                    "run_id": run_id,
                    "node_id": node_id,
                    "file": file_name,
                    "kind": "json",
                    "content": json.loads(target_file.read_text(encoding="utf-8")),
                }
        return {
            "run_id": run_id,
            "node_id": node_id,
            "file": file_name,
            "kind": "text",
            "content": target_file.read_text(encoding="utf-8"),
        }

    files: list[dict[str, object]] = []
    for file_path in sorted(node_dir.iterdir(), key=lambda p: p.name):
        if not file_path.is_file():
            continue
        suffix = file_path.suffix.lower()
        if suffix == ".csv":
            files.append(
                {
                    "name": file_path.name,
                    "kind": "csv",
                    "content": None,
                }
            )
            continue
        if suffix == ".json":
            with suppress(json.JSONDecodeError):
                files.append(
                    {
                        "name": file_path.name,
                        "kind": "json",
                        "content": json.loads(file_path.read_text(encoding="utf-8")),
                    }
                )
                continue
        files.append(
            {
                "name": file_path.name,
                "kind": "text",
                "content": file_path.read_text(encoding="utf-8"),
            }
        )
    return {"run_id": run_id, "node_id": node_id, "files": files}


def delete_backtest_run(run_id: str) -> None:
    if not BacktestRunsStore.delete_by_id(run_id):
        raise BacktestRunNotFoundError(run_id)


def _backtest_run_handler(payload: dict[str, object]) -> dict[str, object]:
    from app.backtest.engine.runner import run_backtest_and_persist

    run_id = str(payload.get("run_id", "")).strip()
    if not run_id:
        raise ValueError("backtest.run 任务需要 run_id")
    run_backtest_and_persist(run_id)
    return {"run_id": run_id, "status": "done"}


register_task_handler("backtest.run", _backtest_run_handler)
