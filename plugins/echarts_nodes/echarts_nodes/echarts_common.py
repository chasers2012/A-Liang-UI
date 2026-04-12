"""Shared helpers for echartsy-based workflow nodes."""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable
from typing import Any

import echartsy as ec
import pandas as pd


def _format_x_axis_tick(value: Any) -> Any:
    """缩短刻度文本：日频时间戳用 YYYY-MM-DD，避免整段 ISO 挤在一起。"""
    if hasattr(value, "strftime"):
        try:
            if (
                getattr(value, "hour", 0) == 0
                and getattr(value, "minute", 0) == 0
                and getattr(value, "second", 0) == 0
                and getattr(value, "microsecond", 0) == 0
            ):
                return value.strftime("%Y-%m-%d")
        except (TypeError, ValueError):
            pass
        try:
            return value.isoformat()
        except (TypeError, ValueError):
            pass
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def normalize_x_values(values: list[Any]) -> list[Any]:
    return [_format_x_axis_tick(v) for v in values]


def prepare_dataframe_with_x(data: pd.DataFrame, x_field: str) -> tuple[pd.DataFrame, str]:
    df = data.copy()
    key = x_field.strip()
    x_col = key if key else "__echartsy_x__"
    if key and key not in df.columns:
        raise KeyError(f"x_field {key!r} not found in dataframe columns")
    raw = df.index.tolist() if not key else df[key].tolist()
    df[x_col] = normalize_x_values(raw)
    return df, x_col


def apply_chrome(fig: ec.Figure, title: str, show_legend: bool, show_tooltip: bool) -> None:
    t = title.strip()
    actions: Iterable[tuple[bool, Callable[[], Any]]] = (
        (bool(t), lambda: fig.title(t)),
        (not show_legend, lambda: fig.legend(show=False)),
        (not show_tooltip, lambda: fig.tooltip(trigger="none")),
    )
    tuple(run() for ok, run in actions if ok)


def patch_x_axis_type(option: dict[str, Any], x_axis_type: str) -> None:
    xa = option.get("xAxis")
    (x_axis_type != "category") and isinstance(xa, dict) and xa.update({"type": x_axis_type})


# 类目轴上大约保留的刻度标签数量上限（再多则通过 interval 抽样）
_MAX_CATEGORY_AXIS_LABELS = 16
# 刻度字符串达到该长度及以上时倾斜（如 YYYY-MM-DD 为 10 字符）
_MIN_CHARS_FOR_X_LABEL_SLANT = 10
# 长标签时的倾斜角（度）；避免 echartsy 默认拉成 90° 竖排
_SLANT_X_LABEL_ROTATE = 38


def _apply_slant_for_long_x_labels(axis_label: dict[str, Any], category_data: list[Any]) -> None:
    if not category_data:
        return
    texts = [str(x) for x in category_data]
    max_len = max(len(t) for t in texts)
    if max_len < _MIN_CHARS_FOR_X_LABEL_SLANT:
        return
    cur = axis_label.get("rotate")
    if cur is None or (isinstance(cur, (int, float)) and abs(float(cur)) >= 60):
        axis_label["rotate"] = _SLANT_X_LABEL_ROTATE


def patch_x_axis_label_density(option: dict[str, Any], *, num_categories: int) -> None:
    """缓解 x 轴类目/时间轴标签过密：抽样刻度、隐藏重叠；长文本时刻度倾斜显示。"""
    if num_categories <= 0:
        return
    axes = option.get("xAxis")
    if axes is None:
        return
    axes_list: list[dict[str, Any]] = (
        [axes] if isinstance(axes, dict) else [a for a in axes if isinstance(a, dict)]
    )
    for xa in axes_list:
        x_type = xa.get("type", "category")
        if x_type == "value":
            continue
        data = xa.get("data")
        n = len(data) if isinstance(data, list) and data else num_categories
        label = xa.get("axisLabel")
        if not isinstance(label, dict):
            label = {}
            xa["axisLabel"] = label
        label.setdefault("hideOverlap", True)
        if x_type == "category" and n > _MAX_CATEGORY_AXIS_LABELS:
            interval = max(0, (n - 1) // _MAX_CATEGORY_AXIS_LABELS)
            label.setdefault("interval", interval)
        if x_type == "category" and isinstance(data, list) and data:
            _apply_slant_for_long_x_labels(label, data)


def patch_value_axes_scale_to_data(option: dict[str, Any]) -> None:
    """数值轴默认会保留 0 刻度；开启 scale 使范围更贴合数据（条形图横向时作用在 x 轴）。"""
    for key in ("xAxis", "yAxis"):
        axes = option.get(key)
        if axes is None:
            continue
        axes_list: list[dict[str, Any]] = (
            [axes] if isinstance(axes, dict) else [a for a in axes if isinstance(a, dict)]
        )
        for ax in axes_list:
            if ax.get("type") != "value":
                continue
            if "min" in ax or "max" in ax:
                continue
            ax.setdefault("scale", True)


def coerce_to_dataframe(data: pd.DataFrame | pd.Series) -> pd.DataFrame:
    return data.to_frame(name="value") if isinstance(data, pd.Series) else data


def parse_y_field_list(data: pd.DataFrame, y_fields: str) -> list[str]:
    raw_y = y_fields.strip()
    ys = (
        [str(c) for c in data.columns]
        if raw_y == "*"
        else [x.strip() for x in y_fields.split(",") if x.strip()]
    )
    if not ys:
        raise ValueError("y_fields must contain at least one field (or use *)")
    return ys


def ensure_y_columns(data: pd.DataFrame, y_field_list: list[str]) -> None:
    bad = next((y for y in y_field_list if y not in data.columns), None)
    if bad is not None:
        raise KeyError(f"y_field {bad!r} not found in dataframe columns")


def split_csv_fields(s: str) -> list[str]:
    return [x.strip() for x in s.split(",") if x.strip()]


def finalize_figure_option(fig: ec.Figure) -> dict[str, Any]:
    option = fig.to_option()
    option.pop("_meta", None)
    return option


def _round_display_float(x: float, places: int) -> float:
    if math.isnan(x) or math.isinf(x):
        return x
    if places <= 0:
        return float(round(x))
    return float(round(x, places))


def _round_numeric_tree(obj: Any, places: int) -> Any:
    """Recursively round floats in series data / link payloads (JSON-serializable)."""
    if isinstance(obj, float):
        return _round_display_float(obj, places)
    if isinstance(obj, int) and not isinstance(obj, bool):
        return obj
    if isinstance(obj, dict):
        return {k: _round_numeric_tree(v, places) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_round_numeric_tree(v, places) for v in obj]
    return obj


def _patch_series_data_and_links(series_list: list[Any], places: int) -> None:
    p = places
    for s in series_list:
        if not isinstance(s, dict):
            continue
        if "data" in s:
            s["data"] = _round_numeric_tree(s["data"], p)
        if "links" in s:
            s["links"] = _round_numeric_tree(s["links"], p)


def _patch_radar_indicator_max(option: dict[str, Any], places: int) -> None:
    radar = option.get("radar")
    if not isinstance(radar, dict):
        return
    for ind in radar.get("indicator") or []:
        if not isinstance(ind, dict):
            continue
        mx = ind.get("max")
        if isinstance(mx, float) and not (math.isnan(mx) or math.isinf(mx)):
            ind["max"] = _round_display_float(mx, places)


def _patch_visual_map_bounds(option: dict[str, Any], places: int) -> None:
    vms = option.get("visualMap")
    if vms is None:
        return
    vm_list = vms if isinstance(vms, list) else [vms]
    for vm in vm_list:
        if not isinstance(vm, dict):
            continue
        for bk in ("min", "max"):
            v = vm.get(bk)
            if isinstance(v, float) and not (math.isnan(v) or math.isinf(v)):
                vm[bk] = _round_display_float(v, places)


def patch_value_decimal_places(option: dict[str, Any], places: int) -> None:
    """统一数值显示精度：series.data、sankey/graph links、radar 轴上限、连续型 visualMap。"""
    p = max(0, min(int(places), 15))
    _patch_series_data_and_links(option.get("series") or [], p)
    _patch_radar_indicator_max(option, p)
    _patch_visual_map_bounds(option, p)


def merge_extra_and_pack(
    option: dict[str, Any],
    extra_options: dict[str, Any] | None,
    *,
    value_decimal_places: int = 2,
    value_axes_scale_to_data: bool = True,
) -> dict[str, Any]:
    if value_axes_scale_to_data:
        patch_value_axes_scale_to_data(option)
    patch_value_decimal_places(option, value_decimal_places)
    option.update(extra_options or {})
    return {"type": "echart", "option": option}
