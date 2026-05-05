"""Convert selected DataFrame columns to numeric dtype."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, StringNodeParam, workflow_node
from workflow.node_types import OptionsNodeParam


def _parse_columns_arg(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        cols = [str(x).strip() for x in value if str(x).strip()]
        return list(dict.fromkeys(cols))
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        # support comma / newline separated list
        chunks = []
        for part in raw.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
            chunks.extend(part.split(","))
        cols = [c.strip() for c in chunks if c.strip()]
        return list(dict.fromkeys(cols))
    return [str(value).strip()] if str(value).strip() else []


@workflow_node(
    label="列转数值类型",
    description=(
        "将 DataFrame 中指定列转换为数值类型（pandas.to_numeric）。\n\n"
        "- 支持在「列名列表」里用逗号或换行分隔多个列名\n"
        "- errors=coerce 时，无法解析的值会变成 NaN\n"
        "- errors=raise 时，遇到无法解析的值会报错\n"
        "- errors=ignore 时，无法解析的值保持原样（列 dtype 可能仍为 object）"
    ),
    category="common",
    input_sockets=[
        Socket(
            "table",
            required=True,
            value_type="dataframe",
            label="DataFrame",
            description="需要转换列类型的 DataFrame。",
        ),
        StringNodeParam(
            "columns",
            required=True,
            default="",
            label="列名列表",
            description="要转换为数值类型的列名；用逗号分隔多个列名。",
        ),
        OptionsNodeParam(
            name="errors",
            label="错误处理",
            description="转换失败时如何处理。",
            options=lambda: [
                {"label": "coerce（失败→NaN）", "value": "coerce"},
                {"label": "raise（失败→报错）", "value": "raise"},
                {"label": "ignore（失败→保持原样）", "value": "ignore"},
            ],
            default="coerce",
        ),
        OptionsNodeParam(
            name="downcast",
            label="降级类型（可选）",
            description="尝试把结果 downcast 到更小的数值 dtype。",
            options=lambda: [
                {"label": "不降级", "value": ""},
                {"label": "integer", "value": "integer"},
                {"label": "signed", "value": "signed"},
                {"label": "unsigned", "value": "unsigned"},
                {"label": "float", "value": "float"},
            ],
            default="",
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            value_type="dataframe",
            label="输出",
            description="指定列被转换为数值类型后的 DataFrame。",
        )
    ],
)
class DataFrameToNumericNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        table: pd.DataFrame = kwargs["table"]
        columns = _parse_columns_arg(kwargs.get("columns"))
        errors = str(kwargs.get("errors") or "coerce").strip() or "coerce"
        downcast_raw = kwargs.get("downcast")
        downcast = str(downcast_raw).strip() if downcast_raw is not None else ""

        if not columns:
            raise ValueError("columns 不能为空：请填写需要转换的列名（逗号或换行分隔）")
        if errors not in {"coerce", "raise", "ignore"}:
            raise ValueError("errors 必须是 coerce/raise/ignore")
        if downcast not in {"", "integer", "signed", "unsigned", "float"}:
            raise ValueError("downcast 必须为空或 integer/signed/unsigned/float")

        missing = [c for c in columns if c not in table.columns]
        if missing:
            raise ValueError(f"DataFrame 中不存在列: {missing}")

        out = table.copy()
        for c in columns:
            out[c] = pd.to_numeric(
                out[c],
                errors=errors,  # type: ignore[arg-type]
                downcast=(downcast or None),  # type: ignore[arg-type]
            )
        return out
