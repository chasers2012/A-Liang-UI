"""DataFrame column rename node for common workflows."""

from __future__ import annotations

import json
from typing import Any

import pandas as pd
from workflow import Socket, TextareaNodeParam, workflow_node


def _parse_rename_mapping(rename_mapping: Any) -> dict[str, str]:
    if isinstance(rename_mapping, dict):
        return {str(old): str(new) for old, new in rename_mapping.items()}

    raw_text = str(rename_mapping or "").strip()
    if not raw_text:
        raise ValueError("rename_mapping 不能为空，请填写映射关系")

    if raw_text.startswith("{"):
        parsed = json.loads(raw_text)
        if not isinstance(parsed, dict):
            raise ValueError('JSON 映射必须是对象格式，例如 {"old":"new"}')
        return {str(old): str(new) for old, new in parsed.items()}

    pairs = [item.strip() for item in raw_text.split(",") if item.strip()]
    if not pairs:
        raise ValueError("rename_mapping 格式错误，请使用 old:new,old2:new2 或 JSON 对象")

    mapping: dict[str, str] = {}
    for pair in pairs:
        if ":" not in pair:
            raise ValueError(f"无效映射项: {pair}，请使用 old:new 格式")
        old_name, new_name = pair.split(":", 1)
        old_name = old_name.strip()
        new_name = new_name.strip()
        if not old_name or not new_name:
            raise ValueError(f"无效映射项: {pair}，列名不能为空")
        mapping[old_name] = new_name
    return mapping


@workflow_node(
    label="重命名 DataFrame 列",
    description=(
        "按映射关系重命名 DataFrame 列。\n\n"
        "支持两种映射格式：\n"
        '1) JSON 对象：{"open":"open_price","close":"close_price"}\n'
        "2) 逗号分隔文本：open:open_price,close:close_price\n\n"
        "默认严格模式：若映射中的旧列名在 DataFrame 中不存在会报错。"
    ),
    category="common",
    input_sockets=[
        Socket(
            "table",
            required=True,
            value_type="dataframe",
            label="DataFrame",
            description="需要重命名列的 DataFrame。",
        ),
        TextareaNodeParam(
            "rename_mapping",
            required=True,
            default="",
            label="重命名映射",
            description=("列重命名映射。支持 JSON 对象或 old:new,old2:new2 文本格式。"),
            rows=4,
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
        rename_mapping = _parse_rename_mapping(kwargs.get("rename_mapping"))

        missing_columns = [old_name for old_name in rename_mapping if old_name not in table.columns]
        if missing_columns:
            raise ValueError(f"DataFrame 中不存在这些列: {', '.join(missing_columns)}")

        return table.rename(columns=rename_mapping)
