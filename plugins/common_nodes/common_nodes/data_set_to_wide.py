from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, workflow_node
from workflow.node_types import StringNodeParam


def _parse_fields(raw: str) -> list[str]:
    fields = [part.strip() for part in raw.split(",") if part.strip()]
    if not fields:
        raise ValueError("fields 不能为空，请传入至少一个字段名（逗号分隔）")
    return fields


@workflow_node(
    input_sockets=[
        Socket("data_set", required=True, value_type="data_set", label="数据集"),
        StringNodeParam(
            "fields",
            required=True,
            label="字段列表",
            description="从数据集中读取的字段名，逗号分隔，例如 open,close,volume。",
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            required=True,
            value_type="dataframe",
            label="宽表",
            description="单字段输出列为资产；多字段输出列为 field__asset。",
        )
    ],
    label="数据集字段宽表",
    description=(
        "从数据集中选取指定字段并按资产展开成宽表。\n"
        "\n"
        "输入字段如 `close` 时，输出行为日期、列为资产代码。\n"
        "输入字段如 `open,close` 时，输出列会展开为 `open__AAPL`、`close__AAPL` 形式。"
    ),
    category="common",
)
class DataSetToWideNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        ds: Any = kwargs["data_set"]
        fields = _parse_fields(str(kwargs.get("fields") or ""))

        panel = ds.get_panel(
            fields=fields,
            window=1,
            start_date=ds.start_date,
            end_date=ds.end_date,
            instrument_codes=ds.instrument_codes,
        )
        if panel.empty:
            return pd.DataFrame()
        if not isinstance(panel.index, pd.MultiIndex):
            raise ValueError("数据集返回结果必须是 MultiIndex(date, asset)")

        panel = panel.sort_index()
        first_level = panel.index.get_level_values(0)
        if len(first_level) > 0:
            panel = panel.loc[first_level.notna()]

        if len(fields) == 1:
            wide = panel[fields[0]].unstack("asset")
            wide.index = pd.to_datetime(wide.index, errors="ignore")
            wide.index.name = "date"
            return wide.sort_index().sort_index(axis=1)

        wide_parts: list[pd.DataFrame] = []
        for field in fields:
            part = panel[field].unstack("asset")
            part.columns = [f"{field}__{asset}" for asset in part.columns]
            wide_parts.append(part)
        out = pd.concat(wide_parts, axis=1)
        out.index = pd.to_datetime(out.index, errors="ignore")
        out.index.name = "date"
        return out.sort_index().sort_index(axis=1)
