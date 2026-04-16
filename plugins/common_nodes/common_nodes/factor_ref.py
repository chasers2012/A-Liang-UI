from __future__ import annotations

from typing import Any

import pandas as pd
from app.factors.controller import get_factor
from app.factors.registry import FactorItemsRegistry
from workflow import Socket, workflow_node
from workflow.node_types import OptionsNodeParam


@workflow_node(
    input_sockets=[
        Socket("data_set", required=True, value_type="data_set", label="数据集"),
        OptionsNodeParam(
            name="factor_id",
            label="因子",
            description="选择因子 ID",
            options=lambda: [
                {"label": f.name, "value": f.id} for f in FactorItemsRegistry.list_items()
            ],
        ),
    ],
    output_sockets=[Socket("factor", required=True, value_type="factor", label="因子矩阵")],
    label="因子引用",
    description="加载并计算因子，输出 date,asset MultiIndex 因子数据。",
    category="common",
)
class FactorRefNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        ds: Any = kwargs["data_set"]
        factor_id = str(kwargs.get("factor_id") or "").strip()
        if not factor_id:
            raise ValueError("factor_id 不能为空")
        factor_cls = get_factor(factor_id)
        if factor_cls is None:
            raise ValueError("因子不存在或无法加载")
        if not ds.end_date:
            raise ValueError("数据集缺少 end_date")
        resolver = ds.create_resolver()
        factor = factor_cls(dependency_resolver=resolver)
        df = factor.calculate(
            start_date=ds.start_date, end_date=ds.end_date, instrument_codes=ds.instrument_codes
        )
        col = df.columns[0] if len(df.columns) else factor.name
        factor_df = df[[col]].copy()
        factor_df.index = factor_df.index.set_names(["date", "asset"])
        return factor_df.sort_index()
