from __future__ import annotations

import pandas as pd
import pytest
from factor import DataSet, DataSourceBinding, DependencyResolver
from factor.datasource import FactorDataSource


def _panel(rows: list[tuple], cols: list[str]) -> pd.DataFrame:
    """Each row is (date, asset, *column_values)."""
    data = {
        "date": [r[0] for r in rows],
        "asset": [r[1] for r in rows],
    }
    for i, c in enumerate(cols):
        data[c] = [r[i + 2] for r in rows]
    return pd.DataFrame(data)


class _FixedSource(FactorDataSource):
    def __init__(self, df: pd.DataFrame) -> None:
        self._df = df

    def list_columns(self) -> list[str]:
        return sorted([str(c) for c in self._df.columns], key=lambda x: (x.lower(), x))

    def load_frame(
        self,
        *,
        columns: list[str],
        filters=None,
    ) -> pd.DataFrame:
        missing = [c for c in columns if c not in self._df.columns]
        if missing:
            raise KeyError(missing)
        return self._df[list(columns)].copy()


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

    ds = DataSet(
        [
            DataSourceBinding(
                _FixedSource(ohlc), ["close", "volume"], date_column="date", asset_column="asset"
            ),
            DataSourceBinding(
                _FixedSource(basic), ["pe"], date_column="date", asset_column="asset"
            ),
        ]
    )
    r = DependencyResolver(ds)

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
    ds = DataSet(
        [
            DataSourceBinding(
                _FixedSource(df),
                ["close"],
                alias={"close": "raw_close"},
                date_column="date",
                asset_column="asset",
            )
        ]
    )
    r = DependencyResolver(ds)
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
    ds = DataSet(
        [
            DataSourceBinding(
                _FixedSource(df),
                ["close", "open"],
                alias={"close": "x", "open": "x"},
                date_column="date",
                asset_column="asset",
            )
        ]
    )
    r = DependencyResolver(ds)
    with pytest.raises(ValueError, match="same datasource column"):
        r.get_panel(
            fields=["close", "open"],
            start_date=None,
            end_date="2024-01-31",
            stock_codes=None,
            window=0,
        )


def test_list_registered_fields() -> None:
    ds = DataSet(
        [
            DataSourceBinding(
                _FixedSource(_panel([], [])), ["a", "b"], date_column="date", asset_column="asset"
            ),
            DataSourceBinding(
                _FixedSource(_panel([], [])), ["b", "c"], date_column="date", asset_column="asset"
            ),
        ]
    )
    r = DependencyResolver(ds)
    assert r.list_registered_fields() == ["a", "b", "c"]


def test_unknown_field_raises() -> None:
    ds = DataSet(
        [
            DataSourceBinding(
                _FixedSource(_panel([], [])), ["close"], date_column="date", asset_column="asset"
            ),
        ]
    )
    r = DependencyResolver(ds)
    with pytest.raises(ValueError, match="Unknown dependency field"):
        r.get_panel(
            fields=["nope"],
            start_date=None,
            end_date="2024-01-02",
            stock_codes=None,
            window=0,
        )


def test_no_registration_raises() -> None:
    ds = DataSet([])
    r = DependencyResolver(ds)
    with pytest.raises(ValueError, match="No DataSourceBinding configured"):
        r.get_panel(
            fields=["close"],
            start_date=None,
            end_date="2024-01-02",
            stock_codes=None,
            window=0,
        )
