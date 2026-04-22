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
    output_sockets=[Socket("factor", required=True, value_type="dataframe", label="因子矩阵")],
    label="因子计算",
    description=(
        "加载并计算因子，输出宽表因子矩阵（index=date, columns=asset）。\n"
        "\n"
        "示例输出：\n"
        "\n"
        "| date       | AAPL | MSFT |\n"
        "|------------|------|------|\n"
        "| 2026-04-01 | 1.23 | 0.87 |\n"
        "| 2026-04-02 | 1.18 | 0.91 |\n"
    ),
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

        return df.sort_index().sort_index(axis=1)
