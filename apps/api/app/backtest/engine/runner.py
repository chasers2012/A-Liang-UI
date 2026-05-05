from __future__ import annotations

import shutil
import traceback
from datetime import datetime, timezone

import pandas as pd

from ..registry import BacktestRunsStore
from ..result_manager import BacktestResultManager

DF_SIGNAL_KWARGS = {
    "short_entries",
    "short_exits",
    "size",
    "price",
    "fees",
    "fixed_fees",
    "slippage",
    "min_size",
    "max_size",
    "size_granularity",
    "reject_prob",
    "lock_cash",
    "allow_partial",
    "raise_reject",
    "log",
    "val_price",
    "open",
    "high",
    "low",
    "sl_stop",
    "sl_trail",
    "tp_stop",
}

SCALAR_SIGNAL_KWARGS = {
    "size",
    "size_type",
    "price",
    "fees",
    "fixed_fees",
    "slippage",
    "min_size",
    "max_size",
    "size_granularity",
    "reject_prob",
    "lock_cash",
    "allow_partial",
    "raise_reject",
    "log",
    "accumulate",
    "upon_long_conflict",
    "upon_short_conflict",
    "upon_dir_conflict",
    "upon_opposite_entry",
    "direction",
    "val_price",
    "open",
    "high",
    "low",
    "sl_stop",
    "sl_trail",
    "tp_stop",
    "stop_entry_price",
    "stop_exit_price",
    "upon_stop_exit",
    "upon_stop_update",
    "use_stops",
    "cash_sharing",
    "group_by",
    "ffill_val_price",
    "update_value",
    "seed",
    "freq",
}


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

    from workflow import WorkflowExecutor

    from app.data_set.controller import get_data_set
    from app.strategy.registry import StrategyRegistry

    from .market_data import load_market_data
    from .vectorbt_runner import (
        run_portfolio_from_signals,
    )

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
            workflow_inputs={"data_set_id": rec.data_set_id},
        )
        wf_out = (
            (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
        )
        price = load_market_data(ds).close

        entries = (wf_out or {}).get("entries")
        exits = (wf_out or {}).get("exits")
        if not isinstance(entries, pd.DataFrame) or not isinstance(exits, pd.DataFrame):
            raise ValueError("策略必须输出 entries 和 exits（DataFrame）")

        signal_kwargs: dict[str, object] = {
            k: params[k] for k in SCALAR_SIGNAL_KWARGS if k in params and params[k] is not None
        }
        for k in DF_SIGNAL_KWARGS:
            v = (wf_out or {}).get(k)
            if isinstance(v, pd.DataFrame):
                signal_kwargs[k] = v

        pf = run_portfolio_from_signals(
            price=price,
            entries=entries,
            exits=exits,
            initial_cash=float(params.get("initial_cash", 1_000_000)),
            fees=float(params.get("fees", 0.0)),
            slippage=float(params.get("slippage", 0.0)),
            from_signals_kwargs=signal_kwargs,
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
