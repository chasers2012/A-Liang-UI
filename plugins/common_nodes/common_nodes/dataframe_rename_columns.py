"""DataFrame column rename node for common workflows."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, StringNodeParam, workflow_node


@workflow_node(
    label="重命名 DataFrame 列",
    description=("将 DataFrame 中的一列重命名为新列名。\n\n每个节点只处理一组重命名。"),
    category="common",
    input_sockets=[
        Socket(
            "table",
            required=True,
            value_type="dataframe",
            label="DataFrame",
            description="需要重命名列的 DataFrame。",
        ),
        StringNodeParam(
            "source_column",
            required=True,
            default="",
            label="原始列名",
            description="需要被重命名的列名。",
        ),
        StringNodeParam(
            "target_column",
            required=True,
            default="",
            label="新列名",
            description="重命名后的列名。",
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            value_type="dataframe",
            label="输出",
            description="列名重命名后的 DataFrame。",
        )
    ],
)
class RenameDataFrameColumnsNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        table: pd.DataFrame = kwargs["table"]
        source_column = str(kwargs.get("source_column") or "").strip()
        target_column = str(kwargs.get("target_column") or "").strip()

        if not source_column:
            raise ValueError("source_column 不能为空")
        if not target_column:
            raise ValueError("target_column 不能为空")
        if source_column not in table.columns:
            raise ValueError(f"DataFrame 中不存在列: {source_column}")

        return table.rename(columns={source_column: target_column})
