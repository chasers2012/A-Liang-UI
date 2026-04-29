from __future__ import annotations

from collections.abc import Callable

import pandas as pd

from factor.datasource import BetweenFilter, FactorDataSource, InFilter
from factor.panel import panel_load_start_date


class DataSourceBinding:
    datasource: FactorDataSource
    # 物理列选择：为空表示加载 datasource 的所有列
    columns: list[str]
    date_column: str
    asset_column: str | None

    def __init__(
        self,
        datasource: FactorDataSource,
        columns: list[str] | None = None,
        *,
        date_column: str,
        asset_column: str | None = None,
    ):
        self.datasource = datasource
        self.columns = [str(c).strip() for c in (columns or []) if str(c).strip()]
        self.date_column = str(date_column)
        # 不传时认为 datasource 输出里“没有 asset 列”
        self.asset_column = str(asset_column).strip() if asset_column is not None else None


def _norm_opt_date(value: str | None) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _merge_date(arg: str | None, fallback: str | None) -> str | None:
    """Use ``arg`` when it is a non-empty date string; otherwise ``fallback``."""
    if arg is None:
        return fallback
    n = _norm_opt_date(arg)
    return n if n is not None else fallback


def _norm_instrument_codes(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    out = [str(c).strip() for c in value if str(c).strip()]
    return out if out else None


def _merge_instrument_codes(arg: list[str] | None, fallback: list[str] | None) -> list[str] | None:
    """Use explicit ``arg`` when non-empty; ``None`` means fall back to dataset."""
    if arg is None:
        return _norm_instrument_codes(fallback)
    return _norm_instrument_codes(arg)


class DataSet:
    data_source_bindings: list[DataSourceBinding]
    preprocessor: Callable[[dict[str, pd.DataFrame]], dict[str, pd.DataFrame]] | None
    start_date: str | None
    end_date: str | None
    instrument_codes: list[str] | None

    def __init__(
        self,
        data_source_bindings: list[DataSourceBinding],
        *,
        preprocessor: Callable[[dict[str, pd.DataFrame]], dict[str, pd.DataFrame]] | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        instrument_codes: list[str] | None = None,
    ):
        self.data_source_bindings = data_source_bindings
        self.preprocessor = preprocessor
        self.start_date = _norm_opt_date(start_date)
        self.end_date = _norm_opt_date(end_date)
        self.instrument_codes = _norm_instrument_codes(instrument_codes)

    def create_resolver(self):
        from factor.dependency_resolver import DependencyResolver

        return DependencyResolver(self)

    def list_registered_fields(self) -> list[str]:
        out: list[str] = []
        for b in self.data_source_bindings:
            if b.columns:
                for c in b.columns:
                    if c not in out:
                        out.append(c)
            else:
                for c in b.datasource.list_columns():
                    if c not in out:
                        out.append(c)
        return sorted(out)

    def _physical_plan_for_binding(self, binding: DataSourceBinding) -> list[str]:
        # must include index date column for standardization
        phys_cols = binding.columns if binding.columns else binding.datasource.list_columns()
        needed_cols: list[str] = [binding.date_column]
        if binding.asset_column is not None:
            needed_cols.append(binding.asset_column)
        needed_cols.extend(phys_cols)
        return list(dict.fromkeys([str(c) for c in needed_cols]))

    def _filters_for_binding(
        self,
        binding: DataSourceBinding,
        *,
        load_start: str,
        end_date: str,
        instrument_codes: list[str] | None,
    ) -> list:
        filters: list = [BetweenFilter(column=binding.date_column, start=load_start, end=end_date)]
        if instrument_codes is not None:
            if binding.asset_column is None:
                raise ValueError("instrument_codes 过滤需要 asset_column；或在预处理里完成资产筛选")
            # instrument_codes 默认按资产列（asset_column）进行匹配
            filters.append(
                InFilter(column=binding.asset_column, values=[str(c) for c in instrument_codes])
            )
        return filters

    def _empty_panel(self, *, columns: list[str]) -> pd.DataFrame:
        empty_idx = pd.MultiIndex.from_arrays([[], []], names=["date", "asset"])
        return pd.DataFrame(columns=columns, index=empty_idx)

    def _load_binding_panel(
        self,
        binding: DataSourceBinding,
        *,
        requested: list[str],
        cols: list[str],
        filters: list,
        raw_override: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        raw = (
            raw_override
            if raw_override is not None
            else binding.datasource.load_frame(columns=cols, filters=filters)
        )
        if raw.empty:
            return self._empty_panel(columns=[])

        # preprocessor 可能会把 date/asset 先标准化成 "date"/"asset"
        renamed = raw
        if binding.date_column in raw.columns and "date" not in raw.columns:
            renamed = renamed.rename(columns={binding.date_column: "date"})
        if binding.asset_column in renamed.columns and "asset" not in renamed.columns:
            renamed = renamed.rename(columns={binding.asset_column: "asset"})

        missing_index = sorted({"date", "asset"} - set(renamed.columns))
        if missing_index:
            raise ValueError(
                "Datasource returned frame missing index columns for panel "
                f"(need date/asset standard columns; missing={missing_index}). "
                f"Present: {sorted(set(renamed.columns))}."
            )

        present = [f for f in requested if f in renamed.columns]
        if not present:
            return self._empty_panel(columns=[])

        renamed["date"] = pd.to_datetime(renamed["date"])
        renamed["asset"] = renamed["asset"].astype(str)
        # CSV/SQL often yield object columns (strings); factors assume numeric deps.
        for c in present:
            renamed[c] = pd.to_numeric(renamed[c], errors="coerce")

        return renamed[["date", "asset", *present]].set_index(["date", "asset"]).sort_index()

    def _load_raw_frames_for_panel(
        self,
        *,
        load_start: str | None,
        end_date: str,
        instrument_codes: list[str] | None,
    ) -> tuple[
        dict[str, pd.DataFrame],
        dict[str, tuple[DataSourceBinding, list[str], list]],
    ]:
        raw_frames: dict[str, pd.DataFrame] = {}
        binding_meta: dict[str, tuple[DataSourceBinding, list[str], list]] = {}

        for b in self.data_source_bindings:
            cols = self._physical_plan_for_binding(b)
            filters = self._filters_for_binding(
                b,
                load_start=load_start,
                end_date=end_date,
                instrument_codes=instrument_codes,
            )
            key = getattr(b.datasource, "id", None)
            ds_key = str(key) if key is not None else str(id(b.datasource))
            raw_frames[ds_key] = b.datasource.load_frame(columns=cols, filters=filters)
            binding_meta[ds_key] = (b, cols, filters)

        return raw_frames, binding_meta

    def _apply_preprocessor(
        self,
        *,
        raw_frames: dict[str, pd.DataFrame],
    ) -> dict[str, pd.DataFrame]:
        if self.preprocessor is None:
            return raw_frames
        frames_out = self.preprocessor(raw_frames)
        if frames_out is None:
            return raw_frames
        if not isinstance(frames_out, dict):
            raise ValueError("preprocessor 必须返回 frames 映射（dict[str, pd.DataFrame]]）")
        return frames_out

    def get_panel(
        self,
        *,
        fields: list[str],
        window: int,
        start_date: str | None = None,
        end_date: str | None = None,
        instrument_codes: list[str] | None = None,
    ) -> pd.DataFrame:
        if not fields:
            raise ValueError("fields must be non-empty")
        if not self.data_source_bindings:
            raise ValueError("No DataSourceBinding configured in DataSet")

        eff_start = _merge_date(start_date, self.start_date)
        eff_end = _merge_date(end_date, self.end_date)
        if not eff_end:
            raise ValueError("end_date is required (pass to get_panel or set end_date on DataSet)")
        eff_codes = _merge_instrument_codes(instrument_codes, self.instrument_codes)

        load_start = panel_load_start_date(eff_start, eff_end, window)

        raw_frames, binding_meta = self._load_raw_frames_for_panel(
            load_start=load_start,
            end_date=eff_end,
            instrument_codes=eff_codes,
        )

        if not raw_frames:
            return self._empty_panel(columns=fields)

        raw_frames = self._apply_preprocessor(raw_frames=raw_frames)

        # 3) standardize each binding and join
        parts: list[pd.DataFrame] = []
        for ds_key, (b, cols, filters) in binding_meta.items():
            part = self._load_binding_panel(
                b,
                requested=fields,
                cols=cols,
                filters=filters,
                raw_override=raw_frames.get(ds_key),
            )
            if not part.empty and part.shape[1] > 0:
                parts.append(part)

        if not parts:
            raise ValueError(
                f"preprocessor output does not contain requested fields: {sorted(fields)}"
            )

        merged = parts[0].sort_index()
        for part in parts[1:]:
            merged = merged.join(part.sort_index(), how="inner")

        missing = [f for f in fields if f not in merged.columns]
        if missing:
            raise ValueError(f"Missing requested fields in merged panel: {missing}")
        return merged.reindex(columns=fields)
