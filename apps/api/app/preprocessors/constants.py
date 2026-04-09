USER_PREPROCESSOR_ROOT = "workflow_nodes/preprocessors"
DEFAULT_PREPROCESSOR_SOURCE = """
from __future__ import annotations

from typing import Any
import pandas as pd

from factor import DataPreprocessorBase


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
        # 示例：对所有数据源去重
        out: dict[str, pd.DataFrame] = {}
        for k, df in frames.items():
            out[k] = df.drop_duplicates()
        return out
""".lstrip()
