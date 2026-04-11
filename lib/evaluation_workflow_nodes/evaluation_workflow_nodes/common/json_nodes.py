"""JSON / 文本类通用工作流节点。"""

from __future__ import annotations

import json
from typing import Any

import pandas as pd
from workflow import Socket, TextareaNodeParam, workflow_node


def _parse_json_payload(payload: Any) -> Any:
    if isinstance(payload, str):
        return json.loads(payload)
    return payload


def _json_to_dataframe(obj: Any) -> pd.DataFrame:
    if isinstance(obj, list):
        if not obj:
            return pd.DataFrame()
        if all(isinstance(x, dict) for x in obj):
            return pd.DataFrame(obj)
        return pd.DataFrame({"value": obj})
    if isinstance(obj, dict):
        return pd.DataFrame(obj)
    raise TypeError(f"无法转为 DataFrame：根类型为 {type(obj).__name__}，需 JSON 对象或对象数组")


@workflow_node(
    label="JSON → DataFrame",
    description="将 JSON（对象或对象数组）转为 pandas DataFrame；可连线 payload 或在文本框粘贴 JSON",
    category="common",
    input_sockets=[
        Socket(
            "payload",
            required=False,
            value_type="scalar_json",
            label="JSON 输入",
            description="已解析的 dict/list 或 JSON 字符串；未连线时使用下方文本框",
        ),
        TextareaNodeParam(
            "json_text",
            required=False,
            default="",
            label="JSON 文本",
            description='例如 [{"a":1},{"a":2}] 或 {"col":[1,2]}',
            rows=8,
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            value_type="dataframe",
            label="输出",
            description="解析得到的 DataFrame",
        )
    ],
)
class JsonToDataframeNode:
    def execute(
        self,
        payload: Any = None,
        json_text: str = "",
        **kwargs: Any,
    ) -> pd.DataFrame:
        _ = kwargs
        if payload is not None:
            obj = _parse_json_payload(payload)
        else:
            raw = (json_text or "").strip()
            if not raw:
                raise ValueError("请连接 payload 或在「JSON 文本」中填入内容")
            obj = json.loads(raw)
        return _json_to_dataframe(obj)


@workflow_node(
    label="JSON 解析",
    description="将 JSON 字符串解析为标量 JSON（dict/list/…）；已解析对象原样输出",
    category="common",
    input_sockets=[
        Socket(
            "source_text",
            required=False,
            value_type="string",
            label="JSON 字符串",
            description="上游字符串；未连线时使用下方文本框",
        ),
        TextareaNodeParam(
            "text",
            required=False,
            default="",
            label="JSON 文本",
            description="未连线 source_text 时使用；连线时端口优先生效",
            rows=8,
        ),
    ],
    output_sockets=[
        Socket(
            "out",
            value_type="scalar_json",
            label="输出",
            description="解析后的 Python/JSON 结构",
        )
    ],
)
class JsonParseNode:
    def execute(self, source_text: Any = None, text: str = "", **kwargs: Any) -> Any:
        _ = kwargs
        raw = source_text if source_text is not None else text
        if raw is None:
            raise ValueError("输入为空")
        if isinstance(raw, str):
            s = raw.strip()
            if not s:
                raise ValueError("JSON 文本为空")
            return json.loads(s)
        if isinstance(raw, (dict, list, int, float, bool)):
            return raw
        raise TypeError(f"不支持的输入类型: {type(raw).__name__}")


@workflow_node(
    label="Params - 长文本",
    description="多行文本参数（textarea），原样输出字符串",
    category="common",
    input_sockets=[
        TextareaNodeParam(
            "value",
            required=False,
            default="",
            label="文本内容",
            description="支持多行大段文本",
            rows=10,
        ),
    ],
    output_sockets=[Socket("out", value_type="string", label="输出", description="完整文本字符串")],
)
class LongTextParamsNode:
    def execute(self, value: str = "", **kwargs: Any) -> str:
        _ = kwargs
        return value if isinstance(value, str) else str(value)
