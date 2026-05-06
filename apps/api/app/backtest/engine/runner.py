from __future__ import annotations

import shutil
import traceback
from datetime import datetime, timezone

import pandas as pd
from workflow import WorkflowExecutor

from app.data_set.controller import get_data_set
from app.strategy.registry import StrategyRegistry

from ..registry import BacktestRunsStore
from ..result_manager import BacktestResultManager
from .market_data import load_market_data
from .vectorbt_runner import run_portfolio_from_signals


def run_backtest_and_persist(run_id: str) -> None:
    results = BacktestResultManager.instance()
    rec = BacktestRunsStore.get_item(run_id)
    if rec is None:
        return
    run_dir = results.run_artifact_dir(run_id)
    if run_dir.exists():
        shutil.rmtree(run_dir)
    rec = BacktestRunsStore.update_item(
        run_id,
        status="running",
        start_at=datetime.now(timezone.utc),
    )
    if rec is None:
        return

    try:
        strategy = StrategyRegistry.get_by_id(rec.strategy_id)
        if strategy is None:
            raise ValueError("策略不存在")

        ds = get_data_set(rec.data_set_id)
        if ds is None:
            raise ValueError("数据集不存在")

        params = dict(rec.params or {})

        executor = WorkflowExecutor()
        node_results = executor.execute(
            strategy.workflow,
            workflow_inputs={"data_set": ds},
        )
        wf_out = (
            (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
        )
        market_data = load_market_data(ds)
        if not isinstance(market_data.close, pd.DataFrame):
            raise ValueError("数据集缺少 close 字段，无法执行回测")
        price = market_data.close

        entries = (wf_out or {}).get("entries")
        exits = (wf_out or {}).get("exits")
        if not isinstance(entries, pd.DataFrame) or not isinstance(exits, pd.DataFrame):
            raise ValueError("策略必须输出 entries 和 exits（DataFrame）")

        signal_kwargs: dict[str, object] = {
            k: v
            for k, v in params.items()
            if v is not None and k not in {"strategy_id", "data_set_id"}
        }
        signal_kwargs["open"] = market_data.open
        signal_kwargs["high"] = market_data.high
        signal_kwargs["low"] = market_data.low

        pf = run_portfolio_from_signals(
            price=price,
            entries=entries,
            exits=exits,
            **signal_kwargs,
        )
        results_dir = results.write_node_results(run_id, node_results)
        results.write_portfolio_results(run_id, pf)
        BacktestRunsStore.update_item(
            run_id,
            results_path=results_dir,
            status="success",
            end_at=datetime.now(timezone.utc),
            error=None,
        )
    except Exception as e:
        error_message = f"{type(e).__name__}: {e}\n\n{traceback.format_exc().rstrip()}"
        BacktestRunsStore.update_item(
            run_id,
            status="failed",
            end_at=datetime.now(timezone.utc),
            error=error_message,
        )
