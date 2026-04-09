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
        Socket("dataframe", required=True, value_type="dataframe"),
    ],
    output_sockets=[Socket("dataframe", required=False, value_type="raw_frames")],
)
class NewPreprocessor(DataPreprocessorBase):

    def transform(self, **kwargs: Any) -> pd.DataFrame:
        df = kwargs.get('dataframe')
        print(f"columns: {list(df.columns)}")
        return df
""".lstrip()
