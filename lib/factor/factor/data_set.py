from __future__ import annotations

from collections.abc import Callable

import pandas as pd

from factor.datasource import FactorDataSource
from factor.panel import panel_load_start_date


class DataSourceBinding:
    datasource: FactorDataSource
    # 物理列选择：为空表示加载 datasource 的所有列
    columns: list[str]
    datasource_id: str | None

    def __init__(
        self,
        datasource: FactorDataSource,
        columns: list[str] | None = None,
        *,
        datasource_id: str | None = None,
    ):
        self.datasource = datasource
        self.columns = [str(c).strip() for c in (columns or []) if str(c).strip()]
        self.datasource_id = str(datasource_id).strip() if datasource_id else None


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
    preprocessor: Callable[[dict[str, pd.DataFrame]], pd.DataFrame] | None
    start_date: str | None
    end_date: str | None
    instrument_codes: list[str] | None

    def __init__(
        self,
        data_source_bindings: list[DataSourceBinding],
        *,
        preprocessor: Callable[[dict[str, pd.DataFrame]], pd.DataFrame] | None = None,
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

    def list_preprocessed_fields(
        self,
        *,
        window: int,
        start_date: str | None = None,
        end_date: str | None = None,
        instrument_codes: list[str] | None = None,
    ) -> list[str]:
        if not self.data_source_bindings:
            raise ValueError("No DataSourceBinding configured in DataSet")

        eff_start = _merge_date(start_date, self.start_date)
        eff_end = _merge_date(end_date, self.end_date)
        if not eff_end:
            raise ValueError(
                "end_date is required (pass to list_preprocessed_fields or set end_date on DataSet)"
            )
        eff_codes = _merge_instrument_codes(instrument_codes, self.instrument_codes)
        load_start = panel_load_start_date(eff_start, eff_end, window)

        raw_frames, _binding_meta = self._load_raw_frames_for_panel(
            load_start=load_start,
            end_date=eff_end,
            instrument_codes=eff_codes,
        )
        if not raw_frames:
            return []

        preprocessed = self._apply_preprocessor(raw_frames=raw_frames)
        if preprocessed.empty:
            return []

        if isinstance(preprocessed.index, pd.MultiIndex):
            return [str(c) for c in preprocessed.columns]

        out: list[str] = []
        for c in preprocessed.columns:
            if c not in {"date", "asset"}:
                out.append(str(c))
        return out

    def _physical_plan_for_binding(self, binding: DataSourceBinding) -> list[str]:
        # must include index date column for standardization
        phys_cols = binding.columns if binding.columns else binding.datasource.list_columns()
        date_column = binding.datasource.date_column
        asset_column = binding.datasource.asset_column
        needed_cols: list[str] = [date_column]
        if asset_column is not None:
            needed_cols.append(asset_column)
        needed_cols.extend(phys_cols)
        return list(dict.fromkeys([str(c) for c in needed_cols]))

    def _empty_panel(self, *, columns: list[str]) -> pd.DataFrame:
        empty_idx = pd.MultiIndex.from_arrays([[], []], names=["date", "asset"])
        return pd.DataFrame(columns=columns, index=empty_idx)

    def _standardize_binding_index_columns(
        self, *, binding: DataSourceBinding, frame: pd.DataFrame
    ) -> pd.DataFrame:
        renamed = frame
        date_column = binding.datasource.date_column
        asset_column = binding.datasource.asset_column
        if date_column in renamed.columns and "date" not in renamed.columns:
            renamed = renamed.rename(columns={date_column: "date"})
        if (
            asset_column is not None
            and asset_column in renamed.columns
            and "asset" not in renamed.columns
        ):
            renamed = renamed.rename(columns={asset_column: "asset"})
        return renamed

    def _load_binding_panel(
        self,
        binding: DataSourceBinding,
        *,
        requested: list[str],
        cols: list[str],
        start_date: str,
        end_date: str,
        asset_values: list[str] | None,
        raw_override: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        raw = (
            raw_override
            if raw_override is not None
            else binding.datasource.load_frame(
                columns=cols,
                start_date=start_date,
                end_date=end_date,
                asset_values=asset_values,
            )
        )
        if raw.empty:
            return self._empty_panel(columns=[])

        # preprocessor 可能会把 date/asset 先标准化成 "date"/"asset"
        renamed = self._standardize_binding_index_columns(binding=binding, frame=raw)

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
        dict[str, tuple[DataSourceBinding, list[str], str, str, str | None, list[str] | None]],
    ]:
        raw_frames: dict[str, pd.DataFrame] = {}
        binding_meta: dict[
            str, tuple[DataSourceBinding, list[str], str, str, str | None, list[str] | None]
        ] = {}

        for b in self.data_source_bindings:
            cols = self._physical_plan_for_binding(b)
            start_date = load_start
            asset_column = b.datasource.asset_column
            asset_values = None
            if instrument_codes is not None:
                if asset_column is None:
                    raise ValueError(
                        "instrument_codes 过滤需要 asset_column；或在预处理里完成资产筛选"
                    )
                # instrument_codes 默认按资产列（asset_column）进行匹配
                asset_values = [str(c) for c in instrument_codes]
            ds_key = b.datasource_id if b.datasource_id is not None else str(id(b.datasource))
            raw = b.datasource.load_frame(
                columns=cols,
                start_date=start_date,
                end_date=end_date,
                asset_values=asset_values,
            )
            raw_frames[ds_key] = self._standardize_binding_index_columns(binding=b, frame=raw)
            binding_meta[ds_key] = (
                b,
                cols,
                start_date,
                end_date,
                asset_column,
                asset_values,
            )

        return raw_frames, binding_meta

    def _apply_preprocessor(
        self,
        *,
        raw_frames: dict[str, pd.DataFrame],
    ) -> pd.DataFrame:
        if self.preprocessor is None:
            raise ValueError("数据集未配置预处理器")
        frames_out = self.preprocessor(raw_frames)
        if frames_out is None:
            raise ValueError("预处理器必须返回一个 DataFrame")
        if not isinstance(frames_out, pd.DataFrame):
            raise ValueError("预处理器必须返回一个 DataFrame")
        return frames_out

    def _panel_from_preprocessed(
        self,
        *,
        preprocessed: pd.DataFrame,
        fields: list[str],
    ) -> pd.DataFrame:
        if preprocessed.empty:
            return self._empty_panel(columns=fields)

        # Accept either a panel (MultiIndex) or a raw table with date/asset columns.
        if isinstance(preprocessed.index, pd.MultiIndex):
            idx_names = [str(n) for n in (preprocessed.index.names or [])]
            if "date" not in idx_names or "asset" not in idx_names:
                raise ValueError("预处理器输出 DataFrame 的索引必须包含 MultiIndex(date, asset)")
            panel = preprocessed
        else:
            missing_index = sorted({"date", "asset"} - set(preprocessed.columns))
            if missing_index:
                raise ValueError(
                    "预处理器输出 DataFrame 必须包含 date/asset 列或 MultiIndex(date, asset) 索引；"
                    f"缺少: {missing_index}"
                )
            tmp = preprocessed.copy()
            tmp["date"] = pd.to_datetime(tmp["date"])
            tmp["asset"] = tmp["asset"].astype(str)
            panel = tmp.set_index(["date", "asset"]).sort_index()

        missing_fields = [f for f in fields if f not in panel.columns]
        if missing_fields:
            raise ValueError(f"预处理器输出缺少请求字段: {sorted(missing_fields)}")
        return panel.reindex(columns=fields)

    def get_panel(
        self,
        fields,
        window,
        start_date=None,
        end_date=None,
        instrument_codes=None,
    ):
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

        raw_frames, _binding_meta = self._load_raw_frames_for_panel(
            load_start=load_start,
            end_date=eff_end,
            instrument_codes=eff_codes,
        )

        if not raw_frames:
            return self._empty_panel(columns=fields)

        preprocessed = self._apply_preprocessor(raw_frames=raw_frames)
        return self._panel_from_preprocessed(preprocessed=preprocessed, fields=fields)
