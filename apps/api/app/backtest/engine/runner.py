from __future__ import annotations

import shutil
import traceback
from datetime import datetime, timezone

import pandas as pd

from .registry import BacktestRunsStore
from .result_manager import BacktestResultManager


def _position_to_target_weights(position: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(position.index, pd.MultiIndex):
        raise ValueError("策略输出 position 必须是 MultiIndex(date, asset)")
    if len(position.index.names) < 2:
        raise ValueError("策略输出 position 的索引必须包含 date、asset 两级")

    level_names = list(position.index.names)
    try:
        date_level = level_names.index("date")
        asset_level = level_names.index("asset")
    except ValueError as exc:
        raise ValueError("策略输出 position 的索引名必须为 date、asset") from exc

    if position.shape[1] == 0:
        raise ValueError("策略输出 position 必须至少包含一列持仓值")
    value_col = position.columns[0]

    weights = position[value_col].unstack(level=asset_level)
    if date_level != 0:
        weights = weights.sort_index()

    weights.index.name = "date"
    weights.columns = [str(c) for c in weights.columns]
    return weights.dropna()


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

    from .engine.market_data import load_market_data
    from .engine.vectorbt_runner import (
        run_portfolio_from_target_weights,
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
        position = (wf_out or {}).get("position")
        if position is None:
            # Backward compatible fallback for older workflow output key.
            position = (wf_out or {}).get("backtest_inputs")
        if not isinstance(position, pd.DataFrame):
            raise ValueError("策略未输出 position")

        target_weights = _position_to_target_weights(position)

        price = load_market_data(ds).close

        pf = run_portfolio_from_target_weights(
            price=price,
            target_weights=target_weights,
            initial_cash=float(params["initial_cash"]),
            fees=float(params["fees"]),
            slippage=float(params["slippage"]),
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
