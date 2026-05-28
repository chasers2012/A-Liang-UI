"""DataFrame index conversion nodes for common workflows."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, workflow_node
from workflow.node_types import StringNodeParam


def _parse_index_names(raw: str) -> list[str]:
    names = [part.strip() for part in raw.split(",") if part.strip()]
    return names if names else ["date", "asset"]


@workflow_node(
    label="设置 DataFrame Index",
    description=(
        "将输入 DataFrame 的一个或多个列设置为索引。\n\n"
        "参数使用英文逗号分隔列名，例如 `date` 或 `date,asset`。\n\n"
        "例如：\n\n"
        "配置 `index_columns = date,asset` 时，输入 DataFrame 为：\n\n"
        "| date       | asset | value |\n"
        "|------------|-------|-------|\n"
        "| 2026-04-01 | A     | 1.2   |\n"
        "| 2026-04-01 | B     | 2.3   |\n"
        "| 2026-04-02 | A     | 1.4   |\n"
        "| 2026-04-02 | B     | 2.1   |\n\n"
        "转换后会得到：\n\n"
        "行索引变为 `MultiIndex(date, asset)`，其中 `date/asset` 不再作为普通列出现；"
        "只保留剩余列（此例为 `value`）。\n\n"
        "| (date)     |(asset)| value |\n"
        "|------------|-------|-------|\n"
        "| 2026-04-01 | A     | 1.2   |\n"
        "| 2026-04-01 | B     | 2.3   |\n"
        "| 2026-04-02 | A     | 1.4   |\n"
        "| 2026-04-02 | B     | 2.1   |"
    ),
    category="common",
    input_sockets=[
        Socket(
            "table",
            required=True,
            value_type="dataframe",
            label="DataFrame",
            description="需要设置索引的 DataFrame。",
        ),
        StringNodeParam(
            "index_columns",
            required=True,
            label="索引列名",
            description="要设置为索引的列名，英文逗号分隔，例如 date,asset。",
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            value_type="dataframe",
            label="输出",
            description="设置 index 后的 DataFrame。",
        )
    ],
)
class SetDataFrameIndexNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        table: pd.DataFrame = kwargs["table"]
        raw_index_columns = str(kwargs.get("index_columns") or "")
        index_columns = [part.strip() for part in raw_index_columns.split(",") if part.strip()]
        if not index_columns:
            raise ValueError("index_columns 不能为空，请传入至少一个列名（逗号分隔）")

        missing_columns = [column for column in index_columns if column not in table.columns]
        if missing_columns:
            raise ValueError(f"DataFrame 中不存在这些列: {', '.join(missing_columns)}")

        return table.set_index(index_columns)


@workflow_node(
    label="宽表 → MultiIndex",
    description=(
        "将宽表转换为 MultiIndex(行索引，列索引) 长表。\n\n"
        "例如：\n\n"
        "配置索引名称为`date,asset`，数值列名为`value`时，\n\n"
        "| date       | A   | B   |\n"
        "|------------|-----|-----|\n"
        "| 2026-04-01 | 1.2 | 2.3 |\n"
        "| 2026-04-02 | 1.4 | 2.1 |\n\n"
        "转换后会得到：\n\n"
        "| date       | asset | value |\n"
        "|------------|-------|-------|\n"
        "| 2026-04-01 | A     | 1.2   |\n"
        "| 2026-04-01 | B     | 2.3   |\n"
        "| 2026-04-02 | A     | 1.4   |\n"
        "| 2026-04-02 | B     | 2.1   |\n"
    ),
    category="common",
    input_sockets=[
        Socket(
            "table",
            required=True,
            value_type="dataframe",
            label="宽表",
            description="需要转换的宽表",
        ),
        StringNodeParam(
            "index_names",
            required=False,
            default="date,asset",
            label="索引名称",
            description="输出 MultiIndex 的索引名称，英文逗号分隔，默认 date,asset。",
        ),
        StringNodeParam(
            "value_name",
            required=False,
            default="value",
            label="数值列名",
            description="输出长表中的数值列名称，默认 value。",
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            value_type="dataframe",
            label="输出",
            description="MultiIndex 长表（date, asset）。",
        )
    ],
)
class WideToMultiIndexNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        table: pd.DataFrame = kwargs["table"]
        if table.empty:
            idx = pd.MultiIndex.from_arrays(
                [[], []], names=_parse_index_names(str(kwargs.get("index_names") or "date,asset"))
            )
            return pd.DataFrame(index=idx, columns=[str(kwargs.get("value_name") or "value")])

        value_name = str(kwargs.get("value_name") or "value")
        index_names = _parse_index_names(str(kwargs.get("index_names") or "date,asset"))
        df = table.copy()
        df.index = pd.to_datetime(df.index, errors="ignore")
        df.index.name = index_names[0]
        long_df = df.stack(dropna=False).rename(value_name).to_frame()
        long_df.index = long_df.index.set_names(index_names)
        return long_df.sort_index()


@workflow_node(
    label="MultiIndex → 宽表",
    description=(
        "将 MultiIndex 长表转换为宽表。\n\n"
        "例如：\n\n"
        "数值列名为`value`时，\n\n"
        "\n"
        "| date       | asset | value |\n"
        "|------------|-------|-------|\n"
        "| 2026-04-01 | A     | 1.2   |\n"
        "| 2026-04-01 | B     | 2.3   |\n"
        "| 2026-04-02 | A     | 1.4   |\n"
        "| 2026-04-02 | B     | 2.1   |\n"
        "\n"
        "转换后会得到：\n\n"
        "\n"
        "| date       | A   | B   |\n"
        "|------------|-----|-----|\n"
        "| 2026-04-01 | 1.2 | 2.3 |\n"
        "| 2026-04-02 | 1.4 | 2.1 |\n"
    ),
    category="common",
    input_sockets=[
        Socket(
            "table",
            required=True,
            value_type="dataframe",
            label="长表",
            description="索引应为 MultiIndex(date, asset)。",
        ),
        StringNodeParam(
            "value_column",
            required=False,
            default="value",
            label="数值列",
            description="从长表中取值的列名，默认 value。",
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            value_type="dataframe",
            label="输出",
            description="宽表（行=日期，列=资产）。",
        )
    ],
)
class MultiIndexToWideNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        table: pd.DataFrame = kwargs["table"]
        value_column = str(kwargs.get("value_column") or "value")
        if table.empty:
            return pd.DataFrame()
        if not isinstance(table.index, pd.MultiIndex):
            raise ValueError("table 的索引必须是 MultiIndex(date, asset)")
        if value_column not in table.columns:
            if len(table.columns) == 1:
                value_column = table.columns[0]
            else:
                raise ValueError(f"找不到数值列 {value_column}")
        wide = table[value_column].unstack("asset")
        wide.index = pd.to_datetime(wide.index, errors="ignore")
        wide.index.name = "date"
        return wide.sort_index()
