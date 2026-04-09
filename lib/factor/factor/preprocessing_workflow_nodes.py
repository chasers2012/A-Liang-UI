from __future__ import annotations

from typing import Any

from workflow import Socket, workflow_node

_RAW_FRAMES_VALUE_TYPE = "raw_frames"


@workflow_node(
    label="原始 frames 输入",
    description="由数据集加载原始数据后提供给预处理工作流的 frames 映射。",
    category="data_set_preprocess",
    input_sockets=[],
    output_sockets=[
        Socket(
            "frames",
            required=True,
            value_type=_RAW_FRAMES_VALUE_TYPE,
            label="raw frames",
            description="dict[str, pd.DataFrame] 的 JSON 工作流值（运行时由后端注入）。",
        )
    ],
)
class DataSetFramesInput:
    def execute(self, **kwargs: Any) -> Any:
        frames = kwargs.get("frames")
        if frames is None:
            raise ValueError("workflow context 缺少 frames")
        return frames


@workflow_node(
    label="预处理结果收集",
    description="作为预处理工作流的终点：输出最终的 frames 供数据集后续标准化与合并使用。",
    category="data_set_preprocess",
    input_sockets=[
        Socket(
            "frames",
            required=True,
            value_type=_RAW_FRAMES_VALUE_TYPE,
            label="输入 frames",
        )
    ],
    output_sockets=[
        Socket(
            "frames",
            value_type=_RAW_FRAMES_VALUE_TYPE,
            label="输出 frames",
        )
    ],
)
class CollectFrames:
    def execute(self, frames: Any, **kwargs: Any) -> Any:
        _ = kwargs
        return frames
