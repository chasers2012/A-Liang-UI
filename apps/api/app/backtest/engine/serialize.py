from __future__ import annotations

from typing import Any


def _to_jsonable_sequence(value: Any) -> Any:
    return [_to_jsonable(v) for v in value]


def _to_jsonable_numpy(value: Any) -> Any:
    import numpy as np

    if isinstance(value, np.ndarray):
        return _to_jsonable(value.tolist())
    if isinstance(value, np.generic):
        return _to_jsonable(value.item())
    return None


def _to_jsonable_pandas(value: Any) -> Any:
    import pandas as pd

    if isinstance(value, pd.DataFrame):
        frame = value.copy()
        frame.columns = [str(c) for c in frame.columns]
        frame = frame.reset_index()
        return _to_jsonable(frame.to_dict(orient="records"))
    if isinstance(value, pd.Series):
        series = value.copy()
        frame = series.rename("value").reset_index()
        return _to_jsonable(frame.to_dict(orient="records"))
    if isinstance(value, pd.Index):
        return _to_jsonable(list(value))
    return None


def _to_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass
    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return _to_jsonable_sequence(value)
    try:
        converted = _to_jsonable_numpy(value)
        if converted is not None:
            return converted
    except Exception:
        pass
    try:
        converted = _to_jsonable_pandas(value)
        if converted is not None:
            return converted
    except Exception:
        pass
    return str(value)


def portfolio_to_results_dict(pf: Any, *, max_trades: int = 2000) -> dict[str, Any]:
    # Equity curve (portfolio value)
    try:
        value = pf.value()
    except Exception:
        value = None

    equity_curve: list[dict[str, Any]] = []
    if value is not None:
        try:
            import pandas as pd

            if isinstance(value, pd.DataFrame):
                # vectorbt may return per-asset portfolio values; aggregate to a single
                # total equity series so the frontend chart can render one curve.
                value = value.sum(axis=1)
            if isinstance(value, pd.Series):
                frame = value.rename("value").reset_index()
                frame.columns = ["date", "value"] if len(frame.columns) >= 2 else frame.columns
                equity_curve = _to_jsonable(frame.to_dict(orient="records"))
            else:
                equity_curve = _to_jsonable(value) if value is not None else []
        except Exception:
            equity_curve = _to_jsonable(value) if value is not None else []

    # Stats (keep small)
    stats: dict[str, Any] = {}
    try:
        s = pf.stats()
        stats = _to_jsonable(s) if s is not None else {}
    except Exception:
        stats = {}

    # Trades (best-effort, trimmed)
    trades: list[dict[str, Any]] = []
    try:
        recs = pf.trades.records_readable
        if recs is not None:
            trades_raw = _to_jsonable(recs)
            if isinstance(trades_raw, list):
                trades = trades_raw[: max(0, int(max_trades))]
    except Exception:
        trades = []

    return {
        "stats": stats,
        "equity_curve": equity_curve,
        "trades": trades,
    }
