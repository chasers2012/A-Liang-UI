"""Built-in workflow node: aggregate returns tear sheet structured payload."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import Socket, workflow_node


def _normalize_value(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _series_to_records(series: pd.Series) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for idx, val in series.items():
        records.append({"index": _normalize_value(idx), "value": _normalize_value(val)})
    return records


def _dataframe_to_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if isinstance(frame.index, pd.MultiIndex):
        index_names = [name or f"level_{i}" for i, name in enumerate(frame.index.names)]
        for idx, row in frame.iterrows():
            record = {name: _normalize_value(idx[i]) for i, name in enumerate(index_names)}
            for col in frame.columns:
                record[str(col)] = _normalize_value(row[col])
            records.append(record)
        return records

    index_name = frame.index.name or "index"
    for idx, row in frame.iterrows():
        record = {index_name: _normalize_value(idx)}
        for col in frame.columns:
            record[str(col)] = _normalize_value(row[col])
        records.append(record)
    return records


def _placeholder_chart_payload(title: str) -> dict[str, Any]:
    """Valid minimal payload for EchartsLineNode when optional upstream data is absent."""
    return {
        "title": title,
        "x_axis": ["—"],
        "series": [{"name": "—", "type": "line", "data": [0.0], "smooth": True}],
    }


def _chart_payload_mean_return_by_quantile(mean_quant_rateret: pd.DataFrame) -> dict[str, Any]:
    quantile_series: list[dict[str, Any]] = []
    x_axis = [str(col) for col in mean_quant_rateret.columns.tolist()]
    for quantile, row in mean_quant_rateret.iterrows():
        quantile_series.append({"name": f"Q{quantile}", "type": "bar", "data": row.tolist()})
    return {"title": "Mean Return by Quantile", "x_axis": x_axis, "series": quantile_series}


def _chart_payload_quantile_returns_by_date_merged(
    mean_quant_rateret_bydate: pd.DataFrame | None,
) -> dict[str, Any] | None:
    if mean_quant_rateret_bydate is None:
        return None
    if not isinstance(mean_quant_rateret_bydate, pd.DataFrame):
        return None
    if not isinstance(mean_quant_rateret_bydate.index, pd.MultiIndex):
        return None
    idx_names = [name or "index" for name in mean_quant_rateret_bydate.index.names]
    if "factor_quantile" not in idx_names or "date" not in idx_names:
        return None

    raw_dates = mean_quant_rateret_bydate.index.get_level_values("date").unique().tolist()
    try:
        dates = sorted(raw_dates, key=lambda d: pd.Timestamp(d))
    except Exception:
        dates = sorted(raw_dates, key=str)
    x_axis = [_normalize_value(d) for d in dates]
    periods = [str(c) for c in mean_quant_rateret_bydate.columns.tolist()]
    series: list[dict[str, Any]] = []
    for period in periods:
        frame = mean_quant_rateret_bydate[[period]].reset_index()
        frame = frame.rename(columns={period: "value"})
        for quantile, group_df in frame.groupby("factor_quantile"):
            group_df = group_df.sort_values("date")
            date_to_val = {_normalize_value(r["date"]): r["value"] for _, r in group_df.iterrows()}
            data = [date_to_val.get(xd) for xd in x_axis]
            series.append(
                {
                    "name": f"{period} · Q{quantile}",
                    "type": "line",
                    "smooth": True,
                    "data": data,
                }
            )
    if not series:
        return None
    return {
        "title": "Quantile Returns by Date",
        "x_axis": x_axis,
        "series": series,
    }


def _chart_payload_mean_ret_spread(
    mean_ret_spread_quant: pd.Series | pd.DataFrame | dict[str, Any] | list[Any],
) -> dict[str, Any] | None:
    if isinstance(mean_ret_spread_quant, pd.DataFrame):
        spread_series: list[dict[str, Any]] = []
        for period in mean_ret_spread_quant.columns:
            spread_series.append(
                {
                    "name": str(period),
                    "type": "line",
                    "smooth": True,
                    "data": mean_ret_spread_quant[period].tolist(),
                }
            )
        return {
            "title": "Mean Quantile Return Spread",
            "x_axis": [_normalize_value(idx) for idx in mean_ret_spread_quant.index.tolist()],
            "series": spread_series,
        }
    if isinstance(mean_ret_spread_quant, pd.Series):
        return {
            "title": "Mean Quantile Return Spread",
            "x_axis": [_normalize_value(idx) for idx in mean_ret_spread_quant.index.tolist()],
            "series": [
                {
                    "name": "spread",
                    "type": "line",
                    "smooth": True,
                    "data": mean_ret_spread_quant.tolist(),
                }
            ],
        }
    return None


def _chart_payload_factor_cumret_1d(
    factor_returns_1d: pd.Series | dict[str, Any] | list[Any] | None,
) -> dict[str, Any] | None:
    if isinstance(factor_returns_1d, pd.Series):
        return {
            "title": "Factor Portfolio Cumulative Return (1D)",
            "x_axis": [_normalize_value(idx) for idx in factor_returns_1d.index.tolist()],
            "series": [
                {
                    "name": "cumulative_return",
                    "type": "line",
                    "smooth": True,
                    "data": factor_returns_1d.tolist(),
                }
            ],
        }
    return None


@workflow_node(
    label="Returns Tear Structured Output",
    description="聚合 returns tear sheet 主干产物，输出稳定的结构化 JSON",
    category="Alphalens Performance",
    input_sockets=[
        Socket("alpha_beta", required=True, value_type="dataframe"),
        Socket("mean_quant_rateret", required=True, value_type="dataframe"),
        Socket("mean_quant_rateret_bydate", required=False, value_type="dataframe"),
        Socket("mean_ret_spread_quant", required=True, value_type="scalar_json"),
        Socket("std_spread_quant", required=False, value_type="scalar_json"),
        Socket("factor_returns_1d", required=False, value_type="scalar_json"),
    ],
    output_sockets=[
        Socket("structured", value_type="scalar_json"),
        Socket("chart_mean_return_by_quantile", value_type="scalar_json"),
        Socket("chart_quantile_returns_by_date", value_type="scalar_json"),
        Socket("chart_mean_ret_spread", value_type="scalar_json"),
        Socket("chart_factor_cumret_1d", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class ReturnsTearStructuredOutputNode(EvaluationMetric):
    def evaluate(
        self,
        alpha_beta: pd.DataFrame,
        mean_quant_rateret: pd.DataFrame,
        mean_ret_spread_quant: pd.Series | pd.DataFrame | dict[str, Any] | list[Any],
        mean_quant_rateret_bydate: pd.DataFrame | None = None,
        std_spread_quant: pd.Series | pd.DataFrame | dict[str, Any] | list[Any] | None = None,
        factor_returns_1d: pd.Series | dict[str, Any] | list[Any] | None = None,
        **kwargs: Any,
    ) -> tuple[
        dict[str, Any],
        dict[str, Any],
        dict[str, Any],
        dict[str, Any],
        dict[str, Any],
    ]:
        _ = kwargs

        spread_payload = (
            _series_to_records(mean_ret_spread_quant)
            if isinstance(mean_ret_spread_quant, pd.Series)
            else (
                _dataframe_to_records(mean_ret_spread_quant)
                if isinstance(mean_ret_spread_quant, pd.DataFrame)
                else mean_ret_spread_quant
            )
        )
        spread_std_payload = (
            _series_to_records(std_spread_quant)
            if isinstance(std_spread_quant, pd.Series)
            else (
                _dataframe_to_records(std_spread_quant)
                if isinstance(std_spread_quant, pd.DataFrame)
                else std_spread_quant
            )
        )
        cumulative_payload = (
            _series_to_records(factor_returns_1d)
            if isinstance(factor_returns_1d, pd.Series)
            else factor_returns_1d
        )
        structured = {
            "alpha_beta": _dataframe_to_records(alpha_beta),
            "mean_quant_rateret": _dataframe_to_records(mean_quant_rateret),
            "mean_quant_rateret_bydate": (
                _dataframe_to_records(mean_quant_rateret_bydate)
                if mean_quant_rateret_bydate is not None
                else None
            ),
            "mean_ret_spread_quant": spread_payload,
            "std_spread_quant": spread_std_payload,
            "factor_cumulative_returns_1d": cumulative_payload,
        }

        p_mean = _chart_payload_mean_return_by_quantile(mean_quant_rateret)
        p_bydate = _chart_payload_quantile_returns_by_date_merged(mean_quant_rateret_bydate)
        p_spread = _chart_payload_mean_ret_spread(mean_ret_spread_quant)
        p_cum = _chart_payload_factor_cumret_1d(factor_returns_1d)

        return (
            structured,
            p_mean,
            p_bydate
            if p_bydate is not None
            else _placeholder_chart_payload("Quantile Returns by Date（无数据）"),
            p_spread
            if p_spread is not None
            else _placeholder_chart_payload("Mean Quantile Return Spread（无数据）"),
            p_cum
            if p_cum is not None
            else _placeholder_chart_payload("Factor Cumulative Return（无数据）"),
        )
