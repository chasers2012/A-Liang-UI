from __future__ import annotations

import json
import traceback
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from workspace import get_workspace_root

from app.backtest.engine.serialize import portfolio_to_results_dict
from app.backtest.registry import BacktestRunsStore

WORKSPACE_ROOT = Path(get_workspace_root())
BACKTEST_ARTIFACT_DIR = WORKSPACE_ROOT / "backtest_results"


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
    return weights.fillna(0.0)


def _results_path(run_id: str) -> Path:
    return BACKTEST_ARTIFACT_DIR / f"{run_id}.json"


def _write_results_json(run_id: str, results: dict[str, object]) -> str:
    BACKTEST_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    path = _results_path(run_id)
    path.write_text(
        json.dumps(results, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    return str(path.relative_to(WORKSPACE_ROOT))


def run_backtest_and_persist(run_id: str) -> None:
    rec = BacktestRunsStore.get_item(run_id)
    if rec is None:
        return
    rec.status = "running"  # type: ignore[assignment]
    rec.start_at = datetime.now(timezone.utc)
    BacktestRunsStore.save(rec)

    from workflow import WorkflowExecutor

    from app.backtest.engine.market_data import load_market_data
    from app.backtest.engine.vectorbt_runner import (
        run_portfolio_from_target_weights,
    )
    from app.data_set.controller import get_data_set
    from app.strategy.registry import StrategyRegistry

    try:
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
        rec.results_path = _write_results_json(run_id, portfolio_to_results_dict(pf))
        rec.status = "success"  # type: ignore[assignment]
        rec.end_at = datetime.now(timezone.utc)
        rec.error = None
        BacktestRunsStore.save(rec)
    except Exception as e:
        rec.status = "failed"  # type: ignore[assignment]
        rec.end_at = datetime.now(timezone.utc)
        rec.error = "\n".join(
            [
                f"{type(e).__name__}: {e}",
                "",
                traceback.format_exc(),
            ]
        )
        BacktestRunsStore.save(rec)
