USER_PREPROCESSOR_ROOT = "workflow_nodes/preprocessors"
DEFAULT_PREPROCESSOR_SOURCE = """
from __future__ import annotations

from typing import Any
import pandas as pd

from factor import DataPreprocessorBase
from workflow import Socket, workflow_node


@workflow_node(
    label="NewPreprocessor",
    description="新预处理器（模板）",
    category="data_set_preprocess",
    input_sockets=[
        Socket("frames", required=True, value_type="raw_frames"),
        Socket("config_json", required=False, value_type="string"),
        Socket("datasource_ids_csv", required=False, value_type="string"),
    ],
    output_sockets=[Socket("frames", required=False, value_type="raw_frames")],
)
class NewPreprocessor(DataPreprocessorBase):
    \"""新预处理器（模板）

    - frames: dict[datasource_id, raw_dataframe]
    - raw_dataframe: 物理列名的 DataFrame（未 rename、未设 index）
    \"""

    def transform(self, **kwargs: Any) -> dict[str, pd.DataFrame]:
        frames = kwargs.get("frames", {})
        config = kwargs.get("config", {})
        if not isinstance(frames, dict):
            raise ValueError("frames 必须为 dict[str, DataFrame]")
        if not isinstance(config, dict):
            raise ValueError("config 必须为 JSON object")

        # 示例：打印每个输入 dataframe 的所有列名
        for datasource_id, df in frames.items():
            print(f"[{datasource_id}] columns: {list(df.columns)}")
        return frames
""".lstrip()
