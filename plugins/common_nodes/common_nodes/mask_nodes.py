from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, workflow_node
from workflow.node_types import NumberNodeParam, OptionsNodeParam


@workflow_node(
    input_sockets=[
        Socket("input", required=True, value_type="dataframe", label="输入"),
        NumberNodeParam("threshold", required=True, default=0.0, label="阈值"),
        OptionsNodeParam(
            name="operator",
            label="比较方式",
            description="选择比较运算符",
            options=lambda: [
                {"label": "输入 > 阈值", "value": "gt"},
                {"label": "输入 >= 阈值", "value": "ge"},
                {"label": "输入 < 阈值", "value": "lt"},
                {"label": "输入 <= 阈值", "value": "le"},
            ],
        ),
    ],
    output_sockets=[Socket("mask", required=True, value_type="dataframe", label="掩码")],
    label="阈值掩码",
    description=(
        "按阈值生成布尔掩码矩阵。\n"
        "\n"
        "输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | 1.2  | 0.8  | 2.4  |\n"
        "| 2026-04-02 | 0.4  | 1.5  | 0.9  |\n"
        "\n"
        "输出示例（threshold=1.0，operator=gt）：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | False| True |\n"
        "| 2026-04-02 | False| True | False|\n"
    ),
    category="mask",
)
class ThresholdMask:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        input_df: pd.DataFrame = kwargs["input"]
        threshold = float(kwargs.get("threshold") or 0.0)
        operator = str(kwargs.get("operator") or "gt")
        if operator == "gt":
            return (input_df > threshold).fillna(False)
        if operator == "ge":
            return (input_df >= threshold).fillna(False)
        if operator == "lt":
            return (input_df < threshold).fillna(False)
        if operator == "le":
            return (input_df <= threshold).fillna(False)
        raise ValueError("operator 必须是 gt/ge/lt/le")


@workflow_node(
    input_sockets=[
        Socket("left", required=True, value_type="dataframe", label="左侧掩码"),
        Socket("right", required=True, value_type="dataframe", label="右侧掩码"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="输出")],
    label="掩码与",
    description=(
        "对两个布尔掩码做逻辑与合并。\n"
        "\n"
        "左侧输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | False| True |\n"
        "| 2026-04-02 | True | True | False|\n"
        "\n"
        "右侧输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | True | False|\n"
        "| 2026-04-02 | False| True | True |\n"
        "\n"
        "输出示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | False| False|\n"
        "| 2026-04-02 | False| True | False|\n"
    ),
    category="mask",
)
class MaskAndNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        left: pd.DataFrame = kwargs["left"].fillna(False).astype(bool)
        right: pd.DataFrame = kwargs["right"].fillna(False).astype(bool)
        return left & right


@workflow_node(
    input_sockets=[
        Socket("left", required=True, value_type="dataframe", label="左侧掩码"),
        Socket("right", required=True, value_type="dataframe", label="右侧掩码"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="输出")],
    label="掩码或",
    description=(
        "对两个布尔掩码做逻辑或合并。\n"
        "\n"
        "左侧输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | False| True |\n"
        "| 2026-04-02 | False| True | False|\n"
        "\n"
        "右侧输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | False| True | False|\n"
        "| 2026-04-02 | True | False| True |\n"
        "\n"
        "输出示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | True | True |\n"
        "| 2026-04-02 | True | True | True |\n"
    ),
    category="mask",
)
class MaskOrNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        left: pd.DataFrame = kwargs["left"].fillna(False).astype(bool)
        right: pd.DataFrame = kwargs["right"].fillna(False).astype(bool)
        return left | right


@workflow_node(
    input_sockets=[Socket("mask", required=True, value_type="dataframe", label="掩码")],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="输出")],
    label="掩码取反",
    description=(
        "对布尔掩码取反。\n"
        "\n"
        "输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | False| True |\n"
        "| 2026-04-02 | False| True | False|\n"
        "\n"
        "输出示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | False| True | False|\n"
        "| 2026-04-02 | True | False| True |\n"
    ),
    category="mask",
)
class MaskNotNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        mask: pd.DataFrame = kwargs["mask"].fillna(False).astype(bool)
        return ~mask
