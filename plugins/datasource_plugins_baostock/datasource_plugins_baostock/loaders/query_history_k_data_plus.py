from __future__ import annotations

import baostock as bs
import pandas as pd
from tqdm import tqdm

from ._utils import extract_code_dates, resolve_target_codes

API_NAME = "query_history_k_data_plus"
K_DATA_FIELD_OPTIONS = [
    ("open", "开盘价"),
    ("high", "最高价"),
    ("low", "最低价"),
    ("close", "收盘价"),
    ("preclose", "昨收价"),
    ("volume", "成交量"),
    ("amount", "成交额"),
    ("adjustflag", "复权状态"),
    ("turn", "换手率"),
    ("tradestatus", "交易状态"),
    ("pctChg", "涨跌幅"),
    ("peTTM", "市盈率(TTM)"),
    ("pbMRQ", "市净率(MRQ)"),
    ("psTTM", "市销率(TTM)"),
    ("pcfNcfTTM", "市现率(TTM)"),
    ("isST", "是否ST"),
]
K_DATA_FIELDS = [key for key, _ in K_DATA_FIELD_OPTIONS]
K_DATA_FIELD_LABELS = [label for _, label in K_DATA_FIELD_OPTIONS]
K_DATA_FIELD_ONE_OF = [{"const": key, "title": label} for key, label in K_DATA_FIELD_OPTIONS]
FIXED_COLUMNS = [
    "date",
    "time",
    "code",
    "open",
    "high",
    "low",
    "close",
    "preclose",
    "volume",
    "amount",
    "adjustflag",
    "turn",
    "tradestatus",
    "pctChg",
    "peTTM",
    "pbMRQ",
    "psTTM",
    "pcfNcfTTM",
    "isST",
]

FREQUENCY_OPTIONS = ["d", "w", "m", "5", "15", "30", "60"]
FREQUENCY_LABELS = ["日线", "周线", "月线", "5分钟", "15分钟", "30分钟", "60分钟"]
FREQUENCY_ONE_OF = [
    {"const": key, "title": label}
    for key, label in zip(FREQUENCY_OPTIONS, FREQUENCY_LABELS, strict=True)
]
ADJUSTFLAG_OPTIONS = ["1", "2", "3"]
ADJUSTFLAG_LABELS = ["后复权", "前复权", "不复权"]
ADJUSTFLAG_ONE_OF = [
    {"const": key, "title": label}
    for key, label in zip(ADJUSTFLAG_OPTIONS, ADJUSTFLAG_LABELS, strict=True)
]

# BaoStock 参数说明参考 stockKData.md：
# frequency: d(日)、w(周)、m(月)、5/15/30/60(分钟)
# adjustflag: 1(后复权)、2(前复权)、3(不复权)
json_schema = {
    "type": "object",
    "properties": {
        "frequency": {
            "type": "string",
            "title": "K线周期",
            "description": "周期：d(日)、w(周)、m(月)、5/15/30/60(分钟)。更多说明参考 BaoStock 的 stockKData.md。",
            "oneOf": FREQUENCY_ONE_OF,
            "default": "d",
        },
        "adjustflag": {
            "type": "string",
            "title": "复权类型",
            "description": "复权：1(后复权)、2(前复权)、3(不复权)。更多说明参考 BaoStock 的 stockKData.md。",
            "oneOf": ADJUSTFLAG_ONE_OF,
            "default": "3",
        },
    },
    "required": [],
}


def _normalize_fields(fields: list[str]) -> list[str]:
    normalized = [str(f).strip() for f in fields if str(f).strip()]
    return [f for f in normalized if f in K_DATA_FIELDS]


def load_frame(
    *,
    columns: list[str],
    date_column: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    asset_column: str | None = None,
    asset_values: list[str] | None = None,
    config: dict,
) -> pd.DataFrame:

    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    selected_fields = _normalize_fields(config.get("fields", []))
    start_date, end_date, selected_codes = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=asset_values
    )

    api_fn = getattr(bs, API_NAME, None)
    if api_fn is None or not callable(api_fn):
        raise ValueError(f"baostock 未找到接口: {API_NAME}")

    if not selected_fields:
        selected_fields = list(K_DATA_FIELDS)
    target_codes = resolve_target_codes(selected_codes, start_date=start_date)
    effective_cols = sorted(set(requested_cols) | set(selected_fields) | {"code", "date"})
    frames: list[pd.DataFrame] = []

    for code in tqdm(target_codes, desc="BaoStock 加载K线", unit="只"):
        rs = bs.query_history_k_data_plus(
            code=code,
            fields=",".join(effective_cols),
            start_date=start_date,
            end_date=end_date,
            frequency=config.get("frequency", "d"),
            adjustflag=config.get("adjustflag", "3"),
        )
        if str(rs.error_code) != "0":
            raise ValueError(f"BaoStock 查询失败({code}): {rs.error_msg}")
        df = rs.get_data()
        if not df.empty:
            frames.append(df)

    if not frames:
        return (
            pd.DataFrame(columns=requested_cols)
            if requested_cols
            else pd.DataFrame(columns=effective_cols)
        )
    out = pd.concat(frames, ignore_index=True)
    return out.loc[:, requested_cols] if requested_cols else out
