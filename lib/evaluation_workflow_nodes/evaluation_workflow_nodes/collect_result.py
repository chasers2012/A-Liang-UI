"""Built-in workflow node: collect selected outputs into one result payload."""

from __future__ import annotations

from typing import Any

from workflow import AppendableSocket, workflow_node


@workflow_node(
    label="结果收集",
    description="作为结果汇总终点，最终返回内容由连入该节点的边决定",
    category="factor_evaluation",
    input_sockets=[
        AppendableSocket(
            "in",
            required=False,
            value_type="scalar_json",
            label="输入",
        ),
    ],
    output_sockets=[],
    entry="evaluate",
)
class CollectResult:
    def evaluate(self, **kwargs: Any) -> tuple[()]:
        _ = kwargs
        # 该节点不直接产出值；最终结果由 runner 根据指向该节点的 links 动态汇总。
        return ()
