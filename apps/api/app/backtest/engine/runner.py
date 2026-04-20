from __future__ import annotations

import json
import shutil
import traceback
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from workspace import get_workspace_root

from app.backtest.engine.serialize import portfolio_to_results_dict, serialize_node_results
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
    return weights.dropna()


def _run_artifact_dir(run_id: str) -> Path:
    return BACKTEST_ARTIFACT_DIR / run_id


def _write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def _write_value(path: Path, value: object) -> None:
    if isinstance(value, pd.DataFrame):
        value.to_csv(path, index=False, encoding="utf-8-sig")
        return
    if isinstance(value, pd.Series):
        value.to_csv(path, index=True, encoding="utf-8-sig", header=True)
        return
    _write_json(path, serialize_node_results(value))


def _write_node_results(run_id: str, node_results: object) -> str:
    run_dir = _run_artifact_dir(run_id)
    run_dir.mkdir(parents=True, exist_ok=True)
    nodes = node_results.get("nodes", None) if isinstance(node_results, dict) else None

    if isinstance(nodes, dict):
        for node_id, result in nodes.items():
            node_dir = run_dir / str(node_id)
            node_dir.mkdir(parents=True, exist_ok=True)
            if isinstance(result, dict):
                for key, value in result.items():
                    file_path = node_dir / (
                        f"{key}.csv"
                        if isinstance(value, (pd.DataFrame, pd.Series))
                        else f"{key}.json"
                    )
                    _write_value(file_path, value)
            else:
                _write_value(node_dir / "result.json", result)
    else:
        _write_value(run_dir / "workflow.json", node_results)

    return str(run_dir.relative_to(WORKSPACE_ROOT))


def _write_portfolio_results(run_id: str, pf: object) -> str:
    run_dir = _run_artifact_dir(run_id)
    run_dir.mkdir(parents=True, exist_ok=True)
    _write_json(run_dir / "portfolio.json", portfolio_to_results_dict(pf))
    return str(run_dir.relative_to(WORKSPACE_ROOT))


def run_backtest_and_persist(run_id: str) -> None:
    rec = BacktestRunsStore.get_item(run_id)
    if rec is None:
        return
    run_dir = _run_artifact_dir(run_id)
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
        results_dir = _write_node_results(run_id, node_results)
        _write_portfolio_results(run_id, pf)
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
