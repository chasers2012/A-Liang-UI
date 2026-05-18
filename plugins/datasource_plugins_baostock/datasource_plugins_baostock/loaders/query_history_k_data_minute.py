from __future__ import annotations

from ._catalog import LoaderSpec
from ._history_k_common import (
    MINUTE_FIELDS,
    STOCK_K_DATA_DOC,
    adjustflag_config_schema,
    create_load_frame,
    frequency_config_schema,
    resolve_minute_frequency,
)

load_frame = create_load_frame(
    resolve_frequency=resolve_minute_frequency,
    fields=MINUTE_FIELDS,
    base_keys=frozenset({"date", "time", "code"}),
    tqdm_desc="BaoStock 分钟K线",
    filter_minute_index_codes=True,
)

LOADER_SPEC = LoaderSpec(
    key="query_history_k_data_minute",
    label="分钟K线",
    loader=load_frame,
    config={
        "type": "object",
        "properties": {
            "frequency": frequency_config_schema(
                options=["5", "15", "30", "60"],
                labels=["5分钟", "15分钟", "30分钟", "60分钟"],
                default="5",
                description=(f"5/15/30/60=分钟K；分钟线不包含指数。详见 {STOCK_K_DATA_DOC}"),
            ),
            "adjustflag": adjustflag_config_schema(),
        },
        "required": [],
    },
    columns=list(MINUTE_FIELDS),
    asset_column="code",
    date_column="date",
)
