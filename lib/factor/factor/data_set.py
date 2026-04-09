from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import WorkflowExecutor

from factor.datasource import BetweenFilter, FactorDataSource, InFilter
from factor.panel import panel_load_start_date
from factor.preprocess import DataSetPreprocessorBinding
from factor.preprocessing_workflow_nodes import CollectFrames


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
    preprocessors: list[DataSetPreprocessorBinding]
    # Serialized DAG JSON (see dataset preprocessing workflow).
    preprocessing_workflow: str | None
    start_date: str | None
    end_date: str | None
    instrument_codes: list[str] | None

    def __init__(
        self,
        data_source_bindings: list[DataSourceBinding],
        *,
        preprocessors: list[DataSetPreprocessorBinding] | None = None,
        preprocessing_workflow: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        instrument_codes: list[str] | None = None,
    ):
        self.data_source_bindings = data_source_bindings
        self.preprocessors = list(preprocessors or [])
        self.preprocessing_workflow = preprocessing_workflow
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
        raw_override: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        raw = (
            raw_override
            if raw_override is not None
            else binding.datasource.load_frame(columns=cols, filters=filters)
        )
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

    @staticmethod
    def _extract_collected_frames_from_workflow(
        workflow_json: str,
        node_results: dict[str, dict[str, Any]],
    ) -> dict[str, pd.DataFrame]:
        import json

        payload = json.loads(workflow_json)
        if not isinstance(payload, dict):
            raise TypeError("preprocessing_workflow 须为 JSON 对象")
        nodes_payload = payload.get("nodes", [])
        if not isinstance(nodes_payload, list):
            raise TypeError("workflow.nodes 须为 list")

        collect_ids = [
            n.get("id")
            for n in nodes_payload
            if isinstance(n, dict) and n.get("type") == CollectFrames.type
        ]
        collect_ids = [str(i) for i in collect_ids if isinstance(i, str) and i]

        if not collect_ids:
            raise ValueError("preprocessing_workflow 未找到 CollectFrames 节点")

        # 取最后一个 CollectFrames 作为最终输出
        final_id = collect_ids[-1]
        collected = node_results.get(final_id)
        if not collected or not isinstance(collected, dict):
            raise ValueError(f"CollectFrames 节点 {final_id!r} 未返回 frames")

        frames = collected.get("frames")
        if not isinstance(frames, dict):
            raise ValueError("CollectFrames.frames 必须为 dict[str, pd.DataFrame]")
        return frames

    def _load_raw_frames_for_panel(
        self,
        *,
        fields: list[str],
        load_start: str | None,
        end_date: str,
        instrument_codes: list[str] | None,
    ) -> tuple[
        dict[str, pd.DataFrame],
        dict[str, tuple[DataSourceBinding, list[str], list[str], dict[str, str], list]],
    ]:
        raw_frames: dict[str, pd.DataFrame] = {}
        binding_meta: dict[
            str, tuple[DataSourceBinding, list[str], list[str], dict[str, str], list]
        ] = {}

        for b in self.data_source_bindings:
            requested = self._requested_fields_for_binding(b, fields=fields)
            if not requested:
                continue

            cols, phys_to_logical = self._physical_plan_for_binding(b, requested=requested)
            filters = self._filters_for_binding(
                b,
                load_start=load_start,
                end_date=end_date,
                instrument_codes=instrument_codes,
            )
            key = getattr(b.datasource, "id", None)
            ds_key = str(key) if key is not None else str(id(b.datasource))
            raw_frames[ds_key] = b.datasource.load_frame(columns=cols, filters=filters)
            binding_meta[ds_key] = (b, requested, cols, phys_to_logical, filters)

        return raw_frames, binding_meta

    def _apply_preprocessing_workflow(
        self,
        *,
        raw_frames: dict[str, pd.DataFrame],
    ) -> dict[str, pd.DataFrame]:
        workflow = self.preprocessing_workflow
        if not workflow or not str(workflow).strip():
            return raw_frames

        import json

        payload = json.loads(workflow)
        nodes_payload = payload.get("nodes", [])
        has_collect = isinstance(nodes_payload, list) and any(
            isinstance(n, dict) and n.get("type") == CollectFrames.type for n in nodes_payload
        )
        if not has_collect:
            return raw_frames

        executor = WorkflowExecutor()
        node_results = executor.execute(
            workflow,
            context={"frames": raw_frames},
        )
        return self._extract_collected_frames_from_workflow(
            workflow,
            node_results=node_results,  # type: ignore[arg-type]
        )

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

        raw_frames, binding_meta = self._load_raw_frames_for_panel(
            fields=fields,
            load_start=load_start,
            end_date=eff_end,
            instrument_codes=eff_codes,
        )

        if not raw_frames:
            return self._empty_panel(columns=fields)

        raw_frames = self._apply_preprocessing_workflow(raw_frames=raw_frames)

        # 3) standardize each binding and join
        parts: list[pd.DataFrame] = []
        for ds_key, (b, requested, cols, phys_to_logical, filters) in binding_meta.items():
            parts.append(
                self._load_binding_panel(
                    b,
                    requested=requested,
                    cols=cols,
                    phys_to_logical=phys_to_logical,
                    filters=filters,
                    raw_override=raw_frames.get(ds_key),
                )
            )

        merged = parts[0].sort_index()
        for part in parts[1:]:
            merged = merged.join(part.sort_index(), how="inner")
        return merged[fields]
