from __future__ import annotations

import pandas as pd

from factor.datasource import BetweenFilter, FactorDataSource, InFilter
from factor.panel import panel_load_start_date


class DataSourceBinding:
    datasource: FactorDataSource
    dependencies: list[str]
    alias: dict[str, str] | None = None
    date_column: str
    asset_column: str
    universe_column: str | None = None

    def __init__(
        self,
        datasource: FactorDataSource,
        dependencies: list[str] | None = None,
        alias: dict[str, str] | None = None,
        *,
        date_column: str,
        asset_column: str,
        universe_column: str | None = None,
    ):
        self.datasource = datasource
        self.dependencies = list(dependencies or [])
        self.alias = alias
        self.date_column = str(date_column)
        self.asset_column = str(asset_column)
        self.universe_column = str(universe_column) if universe_column is not None else None


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
    start_date: str | None
    end_date: str | None
    instrument_codes: list[str] | None

    def __init__(
        self,
        data_source_bindings: list[DataSourceBinding],
        *,
        start_date: str | None = None,
        end_date: str | None = None,
        instrument_codes: list[str] | None = None,
    ):
        self.data_source_bindings = data_source_bindings
        self.start_date = _norm_opt_date(start_date)
        self.end_date = _norm_opt_date(end_date)
        self.instrument_codes = _norm_instrument_codes(instrument_codes)

    def create_resolver(self):
        from factor.dependency_resolver import DependencyResolver

        return DependencyResolver(self)

    def list_registered_fields(self) -> list[str]:
        out: list[str] = []
        for b in self.data_source_bindings:
            for f in b.dependencies:
                if f not in out:
                    out.append(f)
        return sorted(out)

    def _binding_for_field(self, field: str) -> DataSourceBinding | None:
        for b in self.data_source_bindings:
            if field in b.dependencies:
                return b
        return None

    def _assert_fields_known(self, fields: list[str]) -> None:
        missing = [f for f in fields if self._binding_for_field(f) is None]
        if missing:
            raise ValueError(
                f"Unknown dependency field(s) {missing!r}; bind a datasource that provides them"
            )

    def _requested_fields_for_binding(
        self, binding: DataSourceBinding, *, fields: list[str]
    ) -> list[str]:
        return [f for f in fields if f in binding.dependencies]

    def _physical_plan_for_binding(
        self, binding: DataSourceBinding, *, requested: list[str]
    ) -> tuple[list[str], dict[str, str]]:
        mapping = binding.alias or {}

        phys_cols: list[str] = []
        phys_to_logical: dict[str, str] = {}
        for f in requested:
            phys = str(mapping.get(f, f))
            if phys in phys_to_logical and phys_to_logical[phys] != f:
                raise ValueError(
                    f"alias maps logical fields {phys_to_logical[phys]!r} and {f!r} "
                    f"to the same datasource column {phys!r}"
                )
            if phys not in phys_to_logical:
                phys_cols.append(phys)
            phys_to_logical[phys] = f

        # must include index columns for standardization
        needed_cols = [binding.date_column, binding.asset_column, *phys_cols]
        cols = list(dict.fromkeys([str(c) for c in needed_cols]))
        return cols, phys_to_logical

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
            ucol = binding.universe_column or binding.asset_column
            filters.append(InFilter(column=ucol, values=[str(c) for c in instrument_codes]))
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
        phys_to_logical: dict[str, str],
        filters: list,
    ) -> pd.DataFrame:
        raw = binding.datasource.load_frame(columns=cols, filters=filters)
        if raw.empty:
            return self._empty_panel(columns=requested)

        required = set(cols)
        present = set(raw.columns)
        missing_cols = sorted(required - present)
        if missing_cols:
            raise ValueError(
                f"Datasource returned frame missing columns: {missing_cols}. "
                f"Columns present: {sorted(present)}."
            )

        renamed = raw.rename(
            columns={
                binding.date_column: "date",
                binding.asset_column: "asset",
                **dict(phys_to_logical),
            }
        )
        renamed["date"] = pd.to_datetime(renamed["date"])
        renamed["asset"] = renamed["asset"].astype(str)
        # CSV/SQL often yield object columns (strings); factors assume numeric deps.
        for c in requested:
            renamed[c] = pd.to_numeric(renamed[c], errors="coerce")
        return renamed[["date", "asset", *requested]].set_index(["date", "asset"]).sort_index()

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

        self._assert_fields_known(fields)

        load_start = panel_load_start_date(eff_start, eff_end, window)

        parts: list[pd.DataFrame] = []

        # stable order: bindings as provided
        for b in self.data_source_bindings:
            requested = self._requested_fields_for_binding(b, fields=fields)
            if not requested:
                continue

            cols, phys_to_logical = self._physical_plan_for_binding(b, requested=requested)
            filters = self._filters_for_binding(
                b,
                load_start=load_start,
                end_date=eff_end,
                instrument_codes=eff_codes,
            )
            parts.append(
                self._load_binding_panel(
                    b,
                    requested=requested,
                    cols=cols,
                    phys_to_logical=phys_to_logical,
                    filters=filters,
                )
            )

        if not parts:
            return self._empty_panel(columns=fields)

        merged = parts[0].sort_index()
        for part in parts[1:]:
            merged = merged.join(part.sort_index(), how="inner")
        return merged[fields]
