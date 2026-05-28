from __future__ import annotations

from ._catalog import LoaderSpec
from ._history_k_common import ADJUSTFLAG_CONFIG_SCHEMA, DAILY_FIELDS, create_load_frame

load_frame = create_load_frame(
    resolve_frequency=lambda _config: "d",
    fields=DAILY_FIELDS,
    base_keys=frozenset({"date", "code"}),
    tqdm_desc="BaoStock 日K线",
)

LOADER_SPEC = LoaderSpec(
    key="query_history_k_data_daily",
    label="日K线",
    loader=load_frame,
    config={
        "type": "object",
        "properties": {
            "adjustflag": ADJUSTFLAG_CONFIG_SCHEMA,
        },
        "required": ["adjustflag"],
    },
    columns=list(DAILY_FIELDS),
    asset_column="code",
    date_column="date",
)
