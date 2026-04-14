from __future__ import annotations

from datetime import datetime, timezone

from app.backtest.registry import BacktestRunsStore


def run_backtest_and_persist(run_id: str) -> None:
    rec = BacktestRunsStore.get_item(run_id)
    if rec is None:
        return
    rec.status = "running"  # type: ignore[assignment]
    rec.start_at = datetime.now(timezone.utc)
    BacktestRunsStore.save(rec)

    from workflow import WorkflowExecutor

    from app.backtest.engine.nodes import (
        BacktestInputs,
        register_strategy_engine_nodes,
    )
    from app.backtest.engine.serialize import portfolio_to_results_dict
    from app.backtest.engine.vectorbt_runner import (
        run_portfolio_from_target_weights,
    )
    from app.data_set.controller import get_data_set
    from app.strategy.registry import StrategyRegistry

    try:
        register_strategy_engine_nodes()

        strategy = StrategyRegistry.get_by_id(rec.strategy_id)
        if strategy is None:
            raise ValueError("策略不存在")

        ds = get_data_set(rec.data_set_id)
        if ds is None:
            raise ValueError("数据集不存在")

        params = dict(rec.params or {})
        started = datetime.now(timezone.utc)
        rec.start_at = started
        BacktestRunsStore.save(rec)

        executor = WorkflowExecutor()
        node_results = executor.execute(
            strategy.workflow,
            workflow_inputs={"data_set": ds},
        )
        wf_out = (
            (node_results.get("workflow_outputs") or {}) if isinstance(node_results, dict) else {}
        )
        bt_inputs = (wf_out or {}).get("backtest_inputs")
        if not isinstance(bt_inputs, BacktestInputs):
            raise ValueError("策略未输出 backtest_inputs")

        price = bt_inputs.close
        # (Open price wiring can be added by extending BacktestInputs later.)

        pf = run_portfolio_from_target_weights(
            price=price,
            target_weights=bt_inputs.weights,
            initial_cash=float(params.get("initial_cash") or 1_000_000.0),
            fees=float(params.get("fees") or 0.0003),
            slippage=float(params.get("slippage") or 0.0),
        )
        rec.results = portfolio_to_results_dict(pf)
        rec.status = "success"  # type: ignore[assignment]
        rec.end_at = datetime.now(timezone.utc)
        rec.error = None
        BacktestRunsStore.save(rec)
    except Exception as e:
        rec.status = "failed"  # type: ignore[assignment]
        rec.end_at = datetime.now(timezone.utc)
        rec.error = str(e)
        BacktestRunsStore.save(rec)
