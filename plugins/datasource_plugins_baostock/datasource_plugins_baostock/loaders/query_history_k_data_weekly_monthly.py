from __future__ import annotations

from ._catalog import LoaderSpec
from ._history_k_common import (
    ADJUSTFLAG_CONFIG_SCHEMA,
    WEEKLY_MONTHLY_FIELDS,
    create_load_frame,
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
            "frequency": {
                "type": "string",
                "title": "K线周期",
                "oneOf": [
                    {"const": "w", "title": "周K线"},
                    {"const": "m", "title": "月K线"},
                ],
                "default": "w",
            },
            "adjustflag": ADJUSTFLAG_CONFIG_SCHEMA,
        },
        "required": ["frequency", "adjustflag"],
    },
    columns=list(WEEKLY_MONTHLY_FIELDS),
    asset_column="code",
    date_column="date",
)
