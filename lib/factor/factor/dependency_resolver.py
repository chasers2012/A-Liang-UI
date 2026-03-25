from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd

from factor.datasource import FactorDataSource


def _merge_panels(dfs: List[pd.DataFrame]) -> pd.DataFrame:
    if not dfs:
        return pd.DataFrame()
    out = dfs[0].sort_index()
    for df in dfs[1:]:
        out = out.join(df.sort_index(), how="inner")
    return out


class DependencyResolver:
    """
    Maps dependency field names to :class:`FactorDataSource` instances and merges
    panels (inner join on MultiIndex ``date`` × ``asset``).

    Same role as trade-backend ``DependencySolver`` for field→source routing,
    but sources are pluggable :class:`FactorDataSource` objects instead of DB tables.

    Not a :class:`FactorDataSource` itself; :class:`Factor` calls :meth:`get_panel`
    on a resolver when ``dependency_resolver=`` is configured.
    """

    def __init__(self) -> None:
        # field -> FactorDataSource (first registration wins per field)
        self._field_to_source: Dict[str, FactorDataSource] = {}
        # logical field name -> column name on the registered FactorDataSource
        self._field_to_physical: Dict[str, str] = {}
        # stable iteration order of sources as registered
        self._sources: List[FactorDataSource] = []

    def register_datasource(
        self,
        source: FactorDataSource,
        fields: List[str],
        alias: Optional[Dict[str, str]] = None,
    ) -> None:
        """
        Register a data source for the given logical dependency field names.

        Args:
            source: Panel provider.
            fields: Names expected by factors (e.g. ``close``).
            alias: Maps logical field name → actual column name on ``source``.
                Omitted entries use the logical name as the physical column name.
        """
        mapping = alias or {}
        if source not in self._sources:
            self._sources.append(source)
        for f in fields:
            if f not in self._field_to_source:
                self._field_to_source[f] = source
                self._field_to_physical[f] = mapping.get(f, f)

    def source_for_field(self, field: str) -> Optional[FactorDataSource]:
        return self._field_to_source.get(field)

    def list_registered_fields(self) -> List[str]:
        return sorted(self._field_to_source.keys())

    def get_panel(
        self,
        *,
        fields: List[str],
        start_date: Optional[str],
        end_date: str,
        stock_codes: Optional[List[str]],
        window: int,
    ) -> pd.DataFrame:
        if not fields:
            raise ValueError("fields must be non-empty")
        if not self._field_to_source:
            raise ValueError("No FactorDataSource registered; use register_datasource first")

        missing = [f for f in fields if f not in self._field_to_source]
        if missing:
            raise ValueError(
                f"Unknown dependency field(s) {missing!r}; register a datasource that provides them"
            )

        by_source: Dict[int, tuple[FactorDataSource, List[str]]] = {}
        order: List[int] = []
        for f in fields:
            src = self._field_to_source[f]
            key = id(src)
            if key not in by_source:
                by_source[key] = (src, [])
                order.append(key)
            by_source[key][1].append(f)

        parts: List[pd.DataFrame] = []
        for key in order:
            src, subfields = by_source[key]
            phys_order: List[str] = []
            phys_to_logical: Dict[str, str] = {}
            for f in subfields:
                p = self._field_to_physical.get(f, f)
                if p in phys_to_logical and phys_to_logical[p] != f:
                    raise ValueError(
                        f"alias maps logical fields {phys_to_logical[p]!r} and {f!r} "
                        f"to the same datasource column {p!r}"
                    )
                if p not in phys_to_logical:
                    phys_order.append(p)
                phys_to_logical[p] = f

            part = src.get_panel(
                fields=phys_order,
                start_date=start_date,
                end_date=end_date,
                stock_codes=stock_codes,
                window=window,
            )
            part = part.rename(columns=phys_to_logical)
            parts.append(part)

        merged = _merge_panels(parts)
        return merged[fields]


class DependencySolverDataSource(FactorDataSource):
    """
    Adapts a class or object with ``DependencySolver``-style ``get_data`` /
    ``list_registered_fields`` into :class:`FactorDataSource`.
    """

    def __init__(self, solver: Any) -> None:
        self._solver = solver

    @staticmethod
    def list_solver_fields(solver: Any) -> List[str]:
        return list(solver.list_registered_fields())

    def get_panel(
        self,
        *,
        fields: List[str],
        start_date: Optional[str],
        end_date: str,
        stock_codes: Optional[List[str]],
        window: int,
    ) -> pd.DataFrame:
        s = self._solver
        return s.get_data(
            fields,
            end_date,
            stock_codes=stock_codes,
            start_date=start_date,
            window=window,
        )
