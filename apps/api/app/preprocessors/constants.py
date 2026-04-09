USER_PREPROCESSOR_ROOT = "workflow_nodes/preprocessors"
DEFAULT_PREPROCESSOR_SOURCE = """
from __future__ import annotations

from typing import Any
import pandas as pd

from factor import DataPreprocessorBase
from workflow import workflow_node


@workflow_node(
    label="NewPreprocessor",
    description="新预处理器（模板）",
    category="data_set_preprocess",
    input_sockets=[],
    output_sockets=[],
)
class NewPreprocessor(DataPreprocessorBase):
    \"""新预处理器（模板）

    - frames: dict[datasource_id, raw_dataframe]
    - raw_dataframe: 物理列名的 DataFrame（未 rename、未设 index）
    \"""

    def transform(
        self,
        frames: dict[str, pd.DataFrame],
        *,
        config: dict[str, Any],
    ) -> dict[str, pd.DataFrame]:
        _ = config
        # 示例：打印每个输入 dataframe 的所有列名
        for datasource_id, df in frames.items():
            print(f"[{datasource_id}] columns: {list(df.columns)}")
        return frames
""".lstrip()
