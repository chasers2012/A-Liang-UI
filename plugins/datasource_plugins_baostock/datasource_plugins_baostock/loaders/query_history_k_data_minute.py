from __future__ import annotations

from ._catalog import LoaderSpec
from ._history_k_common import (
    ADJUSTFLAG_CONFIG_SCHEMA,
    MINUTE_FIELDS,
    create_load_frame,
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
            "frequency": {
                "type": "string",
                "title": "K线周期",
                "oneOf": [
                    {"const": "5", "title": "5分钟"},
                    {"const": "15", "title": "15分钟"},
                    {"const": "30", "title": "30分钟"},
                    {"const": "60", "title": "60分钟"},
                ],
                "default": "5",
            },
            "adjustflag": ADJUSTFLAG_CONFIG_SCHEMA,
        },
        "required": ["frequency", "adjustflag"],
    },
    columns=list(MINUTE_FIELDS),
    asset_column="code",
    date_column="date",
)
