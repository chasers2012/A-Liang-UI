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


def _build_chart_payloads(
    mean_quant_rateret: pd.DataFrame,
    mean_ret_spread_quant: pd.Series | dict[str, Any] | list[Any],
    factor_returns_1d: pd.Series | dict[str, Any] | list[Any] | None,
) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []

    quantile_series: list[dict[str, Any]] = []
    x_axis = [str(col) for col in mean_quant_rateret.columns.tolist()]
    for quantile, row in mean_quant_rateret.iterrows():
        quantile_series.append({"name": f"Q{quantile}", "type": "bar", "data": row.tolist()})
    payloads.append(
        {"title": "Mean Return by Quantile", "x_axis": x_axis, "series": quantile_series}
    )

    if isinstance(mean_ret_spread_quant, pd.Series):
        payloads.append(
            {
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
        )

    if isinstance(factor_returns_1d, pd.Series):
        payloads.append(
            {
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
        )
    return payloads


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
        Socket("chart_payloads", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class ReturnsTearStructuredOutputNode(EvaluationMetric):
    def evaluate(
        self,
        alpha_beta: pd.DataFrame,
        mean_quant_rateret: pd.DataFrame,
        mean_ret_spread_quant: pd.Series | dict[str, Any] | list[Any],
        mean_quant_rateret_bydate: pd.DataFrame | None = None,
        std_spread_quant: pd.Series | dict[str, Any] | list[Any] | None = None,
        factor_returns_1d: pd.Series | dict[str, Any] | list[Any] | None = None,
        **kwargs: Any,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        _ = kwargs

        spread_payload = (
            _series_to_records(mean_ret_spread_quant)
            if isinstance(mean_ret_spread_quant, pd.Series)
            else mean_ret_spread_quant
        )
        spread_std_payload = (
            _series_to_records(std_spread_quant)
            if isinstance(std_spread_quant, pd.Series)
            else std_spread_quant
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
        chart_payloads = _build_chart_payloads(
            mean_quant_rateret=mean_quant_rateret,
            mean_ret_spread_quant=mean_ret_spread_quant,
            factor_returns_1d=factor_returns_1d,
        )
        return structured, chart_payloads
