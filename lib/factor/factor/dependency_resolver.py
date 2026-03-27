from __future__ import annotations

import pandas as pd

from factor.datasource import FactorDataSource


def _merge_panels(dfs: list[pd.DataFrame]) -> pd.DataFrame:
    if not dfs:
        return pd.DataFrame()
    out = dfs[0].sort_index()
    for df in dfs[1:]:
        out = out.join(df.sort_index(), how="inner")
    return out


def _trading_lookback_bdays(window: int, *, tail_extra: int = 0) -> int:
    """
    Business days to step back for a nominal ``window`` (bars / lookback length).

    Adds slack on top of ``window`` because calendars have holidays and panels
    may omit non-trading days; pure ``BDay(window)`` can be too tight.
    """
    w = max(int(window), 0)
    if w == 0:
        return tail_extra
    slack = max(3, (w + 2) // 3)
    return w + slack + tail_extra


def panel_load_start_date(start_date: str | None, end_date: str, window: int) -> str:
    """
    Earliest inclusive calendar date (``YYYY-MM-DD``) to pass to
    :meth:`FactorDataSource.get_panel` for the user-visible ``start_date`` /
    ``end_date`` and factor ``window``.

    When ``start_date`` is None (factor "last day only" semantics), history is
    anchored on ``end_date`` instead.
    """
    end_ts = pd.Timestamp(end_date).normalize()
    w = max(int(window), 0)
    if start_date:
        s = pd.Timestamp(start_date).normalize()
        if w == 0:
            ts = s
        else:
            n = _trading_lookback_bdays(w)
            ts = (s - pd.offsets.BDay(n)).normalize()
    else:
        if w == 0:
            ts = end_ts
        else:
            n = _trading_lookback_bdays(w, tail_extra=1)
            ts = (end_ts - pd.offsets.BDay(n)).normalize()
    return ts.strftime("%Y-%m-%d")


class DependencyResolver:
    """
    Maps dependency field names to :class:`FactorDataSource` instances and merges
    panels (inner join on MultiIndex ``date`` × ``asset``).

    Same role as trade-backend ``DependencySolver`` for field→source routing,
    but sources are pluggable :class:`FactorDataSource` objects instead of DB tables.

    Not a :class:`FactorDataSource` itself; :class:`Factor` loads panels only through
    a resolver (``dependency_resolver`` on the factor or per-call override).

    Uses :func:`panel_load_start_date` to turn ``window`` and optional user
    ``start_date`` into the inclusive ``start_date`` passed to each datasource.
    """

    def __init__(self) -> None:
        # field -> FactorDataSource (first registration wins per field)
        self._field_to_source: dict[str, FactorDataSource] = {}
        # logical field name -> column name on the registered FactorDataSource
        self._field_to_physical: dict[str, str] = {}
        # stable iteration order of sources as registered
        self._sources: list[FactorDataSource] = []

    def register_datasource(
        self,
        source: FactorDataSource,
        fields: list[str],
        alias: dict[str, str] | None = None,
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

    def source_for_field(self, field: str) -> FactorDataSource | None:
        return self._field_to_source.get(field)

    def list_registered_fields(self) -> list[str]:
        return sorted(self._field_to_source.keys())

    def get_panel(
        self,
        *,
        fields: list[str],
        start_date: str | None,
        end_date: str,
        stock_codes: list[str] | None,
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

        load_start = panel_load_start_date(start_date, end_date, window)

        by_source: dict[int, tuple[FactorDataSource, list[str]]] = {}
        order: list[int] = []
        for f in fields:
            src = self._field_to_source[f]
            key = id(src)
            if key not in by_source:
                by_source[key] = (src, [])
                order.append(key)
            by_source[key][1].append(f)

        parts: list[pd.DataFrame] = []
        for key in order:
            src, subfields = by_source[key]
            phys_order: list[str] = []
            phys_to_logical: dict[str, str] = {}
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
                start_date=load_start,
                end_date=end_date,
                stock_codes=stock_codes,
            )
            part = part.rename(columns=phys_to_logical)
            parts.append(part)

        merged = _merge_panels(parts)
        return merged[fields]
