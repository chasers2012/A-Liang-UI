from __future__ import annotations

from typing import Any

from workflow import (
    BooleanNodeParam,
    NumberNodeParam,
    OptionsNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)
from workflow.node_types import DateNodeParam, DateTimeNodeParam


@workflow_node(
    label="Params - Number",
    description="填写 Number Params 并输出",
    category="common",
    input_sockets=[],
    workflow_parameters=[
        NumberNodeParam(
            "value",
            required=False,
            default=1,
            minimum=0,
            maximum=10,
            label="值",
            description="输入数字参数",
        ),
    ],
    output_sockets=[Socket("out", value_type="number", label="输出", description="输出 number 值")],
)
class NumberParamsNode:
    def execute(self, value: float | int = 1, **kwargs: Any) -> float | int:
        _ = kwargs
        return value


@workflow_node(
    label="Params - Boolean",
    description="填写 Boolean Params 并输出",
    category="common",
    input_sockets=[],
    workflow_parameters=[
        BooleanNodeParam(
            "value", required=False, default=False, label="值", description="输入布尔参数"
        ),
    ],
    output_sockets=[
        Socket("out", value_type="boolean", label="输出", description="输出 boolean 值")
    ],
)
class BooleanParamsNode:
    def execute(self, value: bool = False, **kwargs: Any) -> bool:
        _ = kwargs
        return value


@workflow_node(
    label="Params - String",
    description="填写 String Params 并输出",
    category="common",
    input_sockets=[],
    workflow_parameters=[
        StringNodeParam(
            "value", required=False, default="a", label="值", description="输入字符串参数"
        ),
    ],
    output_sockets=[Socket("out", value_type="string", label="输出", description="输出 string 值")],
)
class StringParamsNode:
    def execute(self, value: str = "a", **kwargs: Any) -> str:
        _ = kwargs
        return value


@workflow_node(
    label="Params - Select",
    description="填写 Options/Select Params 并输出",
    category="common",
    input_sockets=[],
    workflow_parameters=[
        OptionsNodeParam(
            "value",
            required=False,
            default="a",
            label="值",
            description="选择枚举字符串值",
            value_type="string",
            options=["a", "b", "c"],
        )
    ],
    output_sockets=[
        Socket("out", value_type="string", label="输出", description="输出选中的 string 值")
    ],
)
class OptionsParamsNode:
    def execute(self, value: str = "a", **kwargs: Any) -> str:
        _ = kwargs
        return value


@workflow_node(
    label="Params - Date",
    description="填写 Date Params 并输出",
    category="common",
    input_sockets=[],
    workflow_parameters=[
        DateNodeParam(
            "value", required=False, default="2026-01-01", label="值", description="输入日期参数"
        ),
    ],
    output_sockets=[Socket("out", value_type="date", label="输出", description="输出 date 值")],
)
class DateParamsNode:
    def execute(self, value: str = "2026-01-01", **kwargs: Any) -> str:
        _ = kwargs
        return value


@workflow_node(
    label="Params - DateTime",
    description="填写 DateTime Params 并输出",
    category="common",
    input_sockets=[],
    workflow_parameters=[
        DateTimeNodeParam(
            "value",
            required=False,
            default="2026-01-01T00:00",
            label="值",
            description="输入日期时间参数",
        ),
    ],
    output_sockets=[
        Socket("out", value_type="datetime", label="输出", description="输出 datetime 值")
    ],
)
class DateTimeParamsNode:
    def execute(self, value: str = "2026-01-01T00:00", **kwargs: Any) -> str:
        _ = kwargs
        return value
