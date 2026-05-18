from __future__ import annotations

import re
from collections.abc import Callable, Iterable

import pandas as pd

from ..client import call_pro
from .api_specs import API_SPECS, TushareApiSpec

_TS_CODE_RE = re.compile(r"^(\d{6})\.(SH|SZ|BJ)$", re.IGNORECASE)
_BAOSTOCK_CODE_RE = re.compile(r"^(sh|sz|bj)\.(\d{6})$", re.IGNORECASE)
_YYYYMMDD_RE = re.compile(r"^\d{8}$")
_YYYYMMDD_MIN = 19000101
_YYYYMMDD_MAX = 21001231


def to_tushare_date(value: str | None) -> str | None:
    if not value:
        return None
    ts = pd.Timestamp(value)
    return ts.strftime("%Y%m%d")


def to_ts_code(code: str) -> str:
    raw = str(code).strip()
    if not raw:
        return raw
    upper = raw.upper()
    m = _TS_CODE_RE.match(upper)
    if m:
        return f"{m.group(1)}.{m.group(2).upper()}"
    m = _BAOSTOCK_CODE_RE.match(raw)
    if m:
        market = m.group(1).upper()
        suffix = {"SH": "SH", "SZ": "SZ", "BJ": "BJ"}[market]
        return f"{m.group(2)}.{suffix}"
    digits = re.sub(r"\D", "", raw)
    if len(digits) != 6:
        return upper
    lower = raw.lower()
    if lower.startswith(("sh", "sz", "bj")):
        market = lower[:2]
        suffix = market.upper()
        return f"{digits}.{suffix}"
    if digits.startswith(("5", "6", "9")):
        return f"{digits}.SH"
    if digits.startswith(("4", "8")):
        return f"{digits}.BJ"
    return f"{digits}.SZ"


def normalize_ts_codes(values: list[str] | None) -> list[str] | None:
    if not values:
        return None
    out = [to_ts_code(v) for v in values if str(v).strip()]
    return out or None


def extract_code_dates(
    *,
    start_date: str | None,
    end_date: str | None,
    asset_values: list[str] | None,
) -> tuple[str | None, str | None, list[str] | None]:
    start = to_tushare_date(start_date)
    end = to_tushare_date(end_date)
    codes = normalize_ts_codes(asset_values)
    return start, end, codes


def select_columns(df: pd.DataFrame, columns: list[str] | None) -> pd.DataFrame:
    if df.empty or not columns:
        return df
    available = [col for col in columns if col in df.columns]
    if available:
        return df.loc[:, available]
    return df


def _is_compact_yyyymmdd_value(value: object) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return False
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, int):
        return _YYYYMMDD_MIN <= value <= _YYYYMMDD_MAX
    text = str(value).strip()
    if not _YYYYMMDD_RE.match(text):
        return False
    as_int = int(text)
    return _YYYYMMDD_MIN <= as_int <= _YYYYMMDD_MAX


def _series_is_compact_yyyymmdd(series: pd.Series) -> bool:
    non_null = series.dropna()
    if non_null.empty:
        return False
    return all(_is_compact_yyyymmdd_value(v) for v in non_null.tolist())


def _compact_yyyymmdd_to_iso(value: object) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, int):
        text = f"{value:08d}"
    else:
        text = str(value).strip()
        if not _YYYYMMDD_RE.match(text):
            return None
    parsed = pd.to_datetime(text, format="%Y%m%d", errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.strftime("%Y-%m-%d")


def normalize_date_column(df: pd.DataFrame, column: str) -> pd.DataFrame:
    """将 Tushare 的 YYYYMMDD 日期列规范为 ISO 日期字符串，便于 CSV / load_frame 识别。"""
    col = str(column).strip()
    if not col or df.empty or col not in df.columns:
        return df
    ser = df[col]
    if pd.api.types.is_datetime64_any_dtype(ser):
        out = df.copy()
        out[col] = ser.dt.normalize().dt.strftime("%Y-%m-%d")
        return out
    if _series_is_compact_yyyymmdd(ser):
        out = df.copy()
        out[col] = ser.map(_compact_yyyymmdd_to_iso)
        return out
    parsed = pd.to_datetime(ser, errors="coerce")
    if parsed.notna().any():
        out = df.copy()
        out[col] = parsed.dt.normalize().dt.strftime("%Y-%m-%d")
        return out
    return df


def resolve_target_codes(
    token: str | None,
    selected_codes: list[str] | None,
    *,
    list_status: str = "L",
) -> list[str]:
    if selected_codes:
        return selected_codes
    df = call_pro(
        token,
        "stock_basic",
        exchange="",
        list_status=list_status,
        fields="ts_code",
    )
    if df.empty or "ts_code" not in df.columns:
        return []
    return [str(v).strip() for v in df["ts_code"].tolist() if str(v).strip()]


def list_open_trade_dates(
    token: str | None,
    start_date: str | None,
    end_date: str | None,
    *,
    exchange: str = "SSE",
) -> list[str]:
    if not start_date or not end_date:
        return []
    df = call_pro(
        token,
        "trade_cal",
        exchange=exchange,
        start_date=start_date,
        end_date=end_date,
        is_open="1",
        fields="cal_date",
    )
    if df.empty or "cal_date" not in df.columns:
        return []
    return [str(v).strip() for v in df["cal_date"].tolist() if str(v).strip()]


def filter_by_ts_codes(df: pd.DataFrame, codes: set[str] | None) -> pd.DataFrame:
    if df.empty or not codes or "ts_code" not in df.columns:
        return df
    return df.loc[df["ts_code"].astype(str).isin(codes)]


def merge_frames(
    frames: Iterable[pd.DataFrame],
    *,
    columns: list[str] | None = None,
) -> pd.DataFrame:
    parts = [frame for frame in frames if not frame.empty]
    if not parts:
        return pd.DataFrame(columns=columns or [])
    return pd.concat(parts, ignore_index=True)


def get_api_spec(api_name: str) -> TushareApiSpec:
    spec = API_SPECS.get(api_name)
    if spec is None:
        raise ValueError(f"未定义的 Tushare 接口规格: {api_name}")
    return spec


def _is_row_limit_hit(df: pd.DataFrame, spec: TushareApiSpec) -> bool:
    return not df.empty and len(df) >= spec.max_rows


def _split_codes_for_retry(codes: list[str]) -> tuple[list[str], list[str]]:
    if len(codes) <= 1:
        return codes, []
    mid = len(codes) // 2
    return codes[:mid], codes[mid:]


def fetch_daily(
    token: str,
    *,
    selected_codes: list[str] | None,
    start_date: str | None,
    end_date: str | None,
    fields: str,
) -> pd.DataFrame:
    """daily: 指定标的时 ts_code(可多码逗号分隔)+日期区间一次请求；全市场多日仅支持 trade_date。"""
    spec = get_api_spec("daily")
    if selected_codes:
        return _fetch_daily_by_codes(
            token,
            selected_codes,
            start_date=start_date,
            end_date=end_date,
            fields=fields,
            spec=spec,
        )
    return _fetch_all_market_by_trade_date(
        token,
        api_name="daily",
        start_date=start_date,
        end_date=end_date,
        fields=fields,
        empty_ts_code=False,
    )


def _fetch_daily_by_codes(
    token: str,
    codes: list[str],
    *,
    start_date: str | None,
    end_date: str | None,
    fields: str,
    spec: TushareApiSpec,
) -> pd.DataFrame:
    if not codes:
        return pd.DataFrame()
    kwargs: dict = {"ts_code": ",".join(codes), "fields": fields}
    if start_date:
        kwargs["start_date"] = start_date
    if end_date:
        kwargs["end_date"] = end_date
    df = call_pro(token, spec.api_name, **kwargs)
    if _is_row_limit_hit(df, spec) and len(codes) > 1:
        left_codes, right_codes = _split_codes_for_retry(codes)
        left = _fetch_daily_by_codes(
            token,
            left_codes,
            start_date=start_date,
            end_date=end_date,
            fields=fields,
            spec=spec,
        )
        right = (
            _fetch_daily_by_codes(
                token,
                right_codes,
                start_date=start_date,
                end_date=end_date,
                fields=fields,
                spec=spec,
            )
            if right_codes
            else pd.DataFrame()
        )
        return merge_frames([left, right])
    return df


def fetch_daily_basic(
    token: str,
    *,
    selected_codes: list[str] | None,
    start_date: str | None,
    end_date: str | None,
    fields: str,
) -> pd.DataFrame:
    """daily_basic: ts_code 与 trade_date 二选一；全市场用 ts_code='' + trade_date。"""
    spec = get_api_spec("daily_basic")
    if not selected_codes:
        return _fetch_all_market_by_trade_date(
            token,
            api_name=spec.api_name,
            start_date=start_date,
            end_date=end_date,
            fields=fields,
            empty_ts_code=True,
        )
    if len(selected_codes) == 1:
        return _fetch_single_code_range(
            token,
            spec.api_name,
            selected_codes[0],
            start_date=start_date,
            end_date=end_date,
            fields=fields,
        )
    return _fetch_subset_codes_or_trade_dates(
        token,
        spec=spec,
        selected_codes=selected_codes,
        start_date=start_date,
        end_date=end_date,
        fields=fields,
        all_market_empty_ts_code=True,
    )


def fetch_moneyflow(
    token: str,
    *,
    selected_codes: list[str] | None,
    start_date: str | None,
    end_date: str | None,
    fields: str,
) -> pd.DataFrame:
    """moneyflow: 全市场单日 trade_date；单股 start_date+end_date。"""
    spec = get_api_spec("moneyflow")
    if not selected_codes:
        return _fetch_all_market_by_trade_date(
            token,
            api_name=spec.api_name,
            start_date=start_date,
            end_date=end_date,
            fields=fields,
            empty_ts_code=False,
        )
    if len(selected_codes) == 1:
        return _fetch_single_code_range(
            token,
            spec.api_name,
            selected_codes[0],
            start_date=start_date,
            end_date=end_date,
            fields=fields,
        )
    return _fetch_subset_codes_or_trade_dates(
        token,
        spec=spec,
        selected_codes=selected_codes,
        start_date=start_date,
        end_date=end_date,
        fields=fields,
        all_market_empty_ts_code=False,
    )


def _fetch_single_code_range(
    token: str,
    api_name: str,
    ts_code: str,
    *,
    start_date: str | None,
    end_date: str | None,
    fields: str,
) -> pd.DataFrame:
    kwargs: dict = {"ts_code": ts_code, "fields": fields}
    if start_date:
        kwargs["start_date"] = start_date
    if end_date:
        kwargs["end_date"] = end_date
    return call_pro(token, api_name, **kwargs)


def _fetch_all_market_by_trade_date(
    token: str,
    *,
    api_name: str,
    start_date: str | None,
    end_date: str | None,
    fields: str,
    empty_ts_code: bool,
) -> pd.DataFrame:
    trade_dates = list_open_trade_dates(token, start_date, end_date)
    if not trade_dates:
        if not start_date or not end_date:
            raise ValueError(f"{api_name} 全市场拉取需要有效的 start_date 与 end_date")
        return pd.DataFrame()
    kwargs_base: dict = {"fields": fields}
    if empty_ts_code:
        kwargs_base["ts_code"] = ""

    if len(trade_dates) == 1:
        return call_pro(token, api_name, trade_date=trade_dates[0], **kwargs_base)

    # Tushare 限制：全市场跨多日只能按 trade_date 分段请求（非按股循环）
    frames = [
        call_pro(token, api_name, trade_date=trade_date, **kwargs_base)
        for trade_date in trade_dates
    ]
    return merge_frames(frames)


def _fetch_subset_codes_or_trade_dates(
    token: str,
    *,
    spec: TushareApiSpec,
    selected_codes: list[str],
    start_date: str | None,
    end_date: str | None,
    fields: str,
    all_market_empty_ts_code: bool,
) -> pd.DataFrame:
    """多标的且接口不支持多码+区间时，在「按股」与「按交易日+过滤」间取请求次数更少者。"""
    trade_dates = list_open_trade_dates(token, start_date, end_date)
    code_set = set(selected_codes)
    if not trade_dates:
        frames = [
            _fetch_single_code_range(
                token,
                spec.api_name,
                ts_code,
                start_date=start_date,
                end_date=end_date,
                fields=fields,
            )
            for ts_code in selected_codes
        ]
        return merge_frames(frames)

    if len(selected_codes) <= len(trade_dates):
        frames = [
            _fetch_single_code_range(
                token,
                spec.api_name,
                ts_code,
                start_date=start_date,
                end_date=end_date,
                fields=fields,
            )
            for ts_code in selected_codes
        ]
        return merge_frames(frames)

    kwargs_base: dict = {"fields": fields}
    if all_market_empty_ts_code:
        kwargs_base["ts_code"] = ""
    frames = [
        filter_by_ts_codes(
            call_pro(token, spec.api_name, trade_date=trade_date, **kwargs_base),
            code_set,
        )
        for trade_date in trade_dates
    ]
    return merge_frames(frames)


def load_by_ts_code_series(
    token: str,
    api_name: str,
    ts_codes: list[str],
    *,
    build_kwargs: Callable[[str], dict],
) -> pd.DataFrame:
    """仅用于 fina_indicator / income / dividend 等官方仅支持单股的接口。"""
    frames = [call_pro(token, api_name, **build_kwargs(ts_code)) for ts_code in ts_codes]
    return merge_frames(frames)
