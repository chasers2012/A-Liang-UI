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
        # 注意：WorkflowExecutor.gather_node_inputs 在只有一条上游连线时会把
        # 形如 `{from_node:from_socket -> value}` 的映射解包为直接的 `value`。
        # CollectResult 需要兼容这两种输入形态。
        if result is None:
            return ()
        # 根据param对结果排序
        from_key = [
            f"{link.get('from_node')}:{link.get('from_socket')}"
            for link in self.params.get("result")
        ]
        if len(from_key) == 1:
            k = from_key[0]
            # 多端口场景：result 是映射
            if isinstance(result, dict) and k in result:
                return [result[k]]
            # 单端口场景：result 已经被解包成上游的直接值
            return [result]

        # 多端口场景：result 必须是映射字典
        if not isinstance(result, dict):
            raise TypeError(
                f"CollectResult expected mapping result for multiple inputs, got {type(result).__name__}"
            )

        missing = [k for k in from_key if k not in result]
        if missing:
            raise KeyError(
                f"CollectResult missing keys {missing!r}; available keys: {list(result.keys())!r}"
            )
        return [result[k] for k in from_key]
