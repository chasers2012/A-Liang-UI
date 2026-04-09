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
            "result",
            required=False,
            value_type="scalar_json",
            label="结果",
        ),
    ],
    output_sockets=[],
    entry="evaluate",
)
class CollectResult:
    def evaluate(self, result=None, **kwargs: Any) -> tuple[()]:
        if result is None:
            return ()
        if not isinstance(result, dict):
            raise TypeError(f"CollectResult expected mapping result, got {type(result).__name__}")

        # 根据 param 对结果排序
        from_key = [
            f"{link.get('from_node')}:{link.get('from_socket')}"
            for link in self.params.get("result")
        ]

        missing = [k for k in from_key if k not in result]
        if missing:
            raise KeyError(
                f"CollectResult missing keys {missing!r}; available keys: {list(result.keys())!r}"
            )
        return [result[k] for k in from_key]
