from __future__ import annotations

from typing import Any

from workflow import (
    BooleanNodeParam,
    NumberNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)
from workflow.node_types import DateNodeParam, DateTimeNodeParam


@workflow_node(
    label="Number",
    description="填写数字并输出",
    category="common",
    input_sockets=[
        NumberNodeParam(
            "value",
            required=False,
            default=0,
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
    label="Boolean",
    description="填写布尔值并输出",
    category="common",
    input_sockets=[
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
    label="String",
    description="填写字符串并输出",
    category="common",
    input_sockets=[
        StringNodeParam(
            "value", required=False, default="", label="值", description="输入字符串参数"
        ),
    ],
    output_sockets=[Socket("out", value_type="string", label="输出", description="输出 string 值")],
)
class StringParamsNode:
    def execute(self, value: str = "a", **kwargs: Any) -> str:
        _ = kwargs
        return value


@workflow_node(
    label="Date",
    description="填写日期并输出",
    category="common",
    input_sockets=[
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
    label="DateTime",
    description="填写时间并输出",
    category="common",
    input_sockets=[
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
