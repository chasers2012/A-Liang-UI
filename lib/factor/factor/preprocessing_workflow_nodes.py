from __future__ import annotations

from typing import Any

from workflow import AppendableSocket, Socket, workflow_node

_RAW_FRAMES_VALUE_TYPE = "dataframe"


@workflow_node(
    label="原始 frames 输入",
    description="由数据集加载原始数据后提供给预处理工作流的 frames 映射。",
    category="data_set_preprocess",
    input_sockets=[],
    output_sockets=[
        Socket(
            "dataframe",
            required=True,
            value_type=_RAW_FRAMES_VALUE_TYPE,
            label="数据源",
            description="dict[str, pd.DataFrame] 的 JSON 工作流值（运行时由后端注入）。",
        )
    ],
)
class DataSetFramesInput:
    def execute(self, **kwargs: Any) -> Any:
        frames = kwargs.get("frames")
        if not isinstance(frames, dict):
            raise ValueError("workflow context 缺少 frames")
        outputs = tuple(getattr(self, "outputs", ()) or ())

        out_values: list[Any] = []
        for socket in outputs:
            name = getattr(socket, "name", "")
            if not name:
                continue
            if name in frames:
                out_values.append(frames[name])
                continue
            out_values.append(None)

        if len(out_values) == 1:
            return out_values[0]
        return tuple(out_values)


@workflow_node(
    label="预处理结果收集",
    description="作为预处理工作流的终点：输出最终的 frames 供数据集后续标准化与合并使用。",
    category="data_set_preprocess",
    input_sockets=[
        AppendableSocket(
            "dataframe",
            required=True,
            value_type=_RAW_FRAMES_VALUE_TYPE,
            label="输入 DataFrame",
        )
    ],
    output_sockets=[],
)
class CollectFrames:
    def execute(self, dataframe: dict[str, Any], **kwargs: Any) -> Any:
        _ = kwargs
        if not isinstance(dataframe, dict):
            raise ValueError("CollectFrames.dataframe 必须为 appendable 输入映射")

        import pandas as pd

        frames: list[pd.DataFrame] = []
        for item in dataframe.values():
            if isinstance(item, dict):
                for v in item.values():
                    if not isinstance(v, pd.DataFrame):
                        raise ValueError("CollectFrames appendable 输入项必须为 DataFrame")
                    frames.append(v)
                continue
            if not isinstance(item, pd.DataFrame):
                raise ValueError("CollectFrames appendable 输入项必须为 DataFrame")
            frames.append(item)

        if not frames:
            raise ValueError("CollectFrames 至少需要一个 dataframe 输入")
        return pd.concat(frames, axis=0)
