from __future__ import annotations

from ._catalog import LoaderSpec
from ._history_k_common import (
    STOCK_K_DATA_DOC,
    WEEKLY_MONTHLY_FIELDS,
    adjustflag_config_schema,
    create_load_frame,
    frequency_config_schema,
    resolve_weekly_monthly_frequency,
)

load_frame = create_load_frame(
    resolve_frequency=resolve_weekly_monthly_frequency,
    fields=WEEKLY_MONTHLY_FIELDS,
    base_keys=frozenset({"date", "code"}),
    tqdm_desc="BaoStock 周/月K线",
)

LOADER_SPEC = LoaderSpec(
    key="query_history_k_data_weekly_monthly",
    label="周/月K线",
    loader=load_frame,
    config={
        "type": "object",
        "properties": {
            "frequency": frequency_config_schema(
                options=["w", "m"],
                labels=["周K线", "月K线"],
                default="w",
                description=(
                    "w=周K、m=月K。周线仅每周最后交易日、月线仅每月最后交易日可获取。"
                    f"详见 {STOCK_K_DATA_DOC}"
                ),
            ),
            "adjustflag": adjustflag_config_schema(),
        },
        "required": [],
    },
    columns=list(WEEKLY_MONTHLY_FIELDS),
    asset_column="code",
    date_column="date",
)
