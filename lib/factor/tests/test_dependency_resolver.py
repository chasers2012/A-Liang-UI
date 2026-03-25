from __future__ import annotations

import pandas as pd
import pytest
from factor import DependencyResolver, DependencySolverDataSource
from factor.datasource import FactorDataSource


def _panel(rows: list[tuple], cols: list[str]) -> pd.DataFrame:
    """Each row is (date, asset, *column_values)."""
    idx = pd.MultiIndex.from_tuples([(r[0], r[1]) for r in rows], names=["date", "asset"])
    data = {c: [r[i + 2] for r in rows] for i, c in enumerate(cols)}
    return pd.DataFrame(data, index=idx)


class _FixedSource(FactorDataSource):
    def __init__(self, df: pd.DataFrame) -> None:
        self._df = df

    def get_panel(
        self,
        *,
        fields: list[str],
        start_date: str | None,
        end_date: str,
        stock_codes: list[str] | None,
        window: int,
    ) -> pd.DataFrame:
        _ = (start_date, end_date, stock_codes, window)
        missing = [f for f in fields if f not in self._df.columns]
        if missing:
            raise KeyError(missing)
        return self._df[list(fields)]


def test_resolver_merges_two_sources_inner_join() -> None:
    rows_common = [
        (pd.Timestamp("2024-01-02"), "A", 1.0, 10.0),
        (pd.Timestamp("2024-01-02"), "B", 2.0, 20.0),
    ]
    ohlc = _panel(rows_common, ["close", "volume"])
    basic_rows = [
        (pd.Timestamp("2024-01-02"), "A", 100.0),
        (pd.Timestamp("2024-01-03"), "A", 101.0),
    ]
    basic = _panel(basic_rows, ["pe"])

    r = DependencyResolver()
    r.register_datasource(_FixedSource(ohlc), ["close", "volume"])
    r.register_datasource(_FixedSource(basic), ["pe"])

    out = r.get_panel(
        fields=["close", "pe"],
        start_date="2024-01-01",
        end_date="2024-01-31",
        stock_codes=None,
        window=0,
    )
    assert list(out.columns) == ["close", "pe"]
    assert len(out) == 1
    assert float(out.iloc[0]["close"]) == 1.0
    assert float(out.iloc[0]["pe"]) == 100.0


def test_register_datasource_alias_maps_physical_columns() -> None:
    """Logical dependency names differ from column names on the underlying source."""
    df = _panel([(pd.Timestamp("2024-01-02"), "A", 99.0)], ["raw_close"])
    r = DependencyResolver()
    r.register_datasource(_FixedSource(df), ["close"], alias={"close": "raw_close"})
    out = r.get_panel(
        fields=["close"],
        start_date="2024-01-01",
        end_date="2024-01-31",
        stock_codes=None,
        window=0,
    )
    assert list(out.columns) == ["close"]
    assert float(out.iloc[0]["close"]) == 99.0


def test_alias_conflict_same_physical_two_logical_raises() -> None:
    df = _panel([(pd.Timestamp("2024-01-02"), "A", 1.0, 2.0)], ["x", "y"])
    r = DependencyResolver()
    r.register_datasource(
        _FixedSource(df),
        ["close", "open"],
        alias={"close": "x", "open": "x"},
    )
    with pytest.raises(ValueError, match="same datasource column"):
        r.get_panel(
            fields=["close", "open"],
            start_date=None,
            end_date="2024-01-31",
            stock_codes=None,
            window=0,
        )


def test_source_for_field_first_registration_wins() -> None:
    df = _panel([(pd.Timestamp("2024-01-02"), "A", 1.0)], ["close"])
    s1 = _FixedSource(df)
    s2 = _FixedSource(df)
    r = DependencyResolver()
    r.register_datasource(s1, ["close"])
    r.register_datasource(s2, ["close"])
    assert r.source_for_field("close") is s1


def test_list_registered_fields() -> None:
    r = DependencyResolver()
    r.register_datasource(_FixedSource(_panel([], [])), ["a", "b"])
    r.register_datasource(_FixedSource(_panel([], [])), ["b", "c"])
    assert r.list_registered_fields() == ["a", "b", "c"]


def test_unknown_field_raises() -> None:
    r = DependencyResolver()
    r.register_datasource(_FixedSource(_panel([], [])), ["close"])
    with pytest.raises(ValueError, match="Unknown dependency field"):
        r.get_panel(
            fields=["nope"],
            start_date=None,
            end_date="2024-01-02",
            stock_codes=None,
            window=0,
        )


def test_no_registration_raises() -> None:
    r = DependencyResolver()
    with pytest.raises(ValueError, match="No FactorDataSource registered"):
        r.get_panel(
            fields=["close"],
            start_date=None,
            end_date="2024-01-02",
            stock_codes=None,
            window=0,
        )


class _FakeSolver:
    @classmethod
    def get_data(
        cls,
        fields: list[str],
        end_date: str,
        stock_codes: list[str] | None = None,
        start_date: str | None = None,
        window: int = 0,
    ) -> pd.DataFrame:
        _ = (stock_codes, window)
        df = _panel(
            [(pd.Timestamp("2024-01-02"), "X", 3.0)],
            fields,
        )
        return df

    @classmethod
    def list_registered_fields(cls) -> list[str]:
        return ["close"]


def test_dependency_solver_source_uses_injected_solver() -> None:
    ds = DependencySolverDataSource(solver=_FakeSolver)
    out = ds.get_panel(
        fields=["close"],
        start_date="2024-01-01",
        end_date="2024-01-31",
        stock_codes=None,
        window=1,
    )
    assert "close" in out.columns
    assert len(out) == 1


def test_dependency_solver_source_list_fields_injected() -> None:
    assert DependencySolverDataSource.list_solver_fields(solver=_FakeSolver) == ["close"]
