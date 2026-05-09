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
    def __init__(
        self, df: pd.DataFrame, *, date_column: str = "date", asset_column: str | None = "asset"
    ) -> None:
        self._df = df
        self._date_column = date_column
        self._asset_column = asset_column

    def list_columns(self) -> list[str]:
        return sorted([str(c) for c in self._df.columns], key=lambda x: (x.lower(), x))

    @property
    def date_column(self) -> str:
        return self._date_column

    @property
    def asset_column(self) -> str | None:
        return self._asset_column

    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        missing = [c for c in columns if c not in self._df.columns]
        if missing:
            raise KeyError(missing)
        out = self._df[list(columns)].copy()
        if self._date_column in out.columns:
            ser = pd.to_datetime(out[self._date_column], errors="coerce")
            if start_date is not None:
                out = out.loc[ser >= pd.Timestamp(start_date)]
                ser = ser.loc[out.index]
            if end_date is not None:
                out = out.loc[ser <= pd.Timestamp(end_date)]
        if (
            self._asset_column is not None
            and asset_values is not None
            and self._asset_column in out.columns
        ):
            out = out.loc[out[self._asset_column].astype(str).isin([str(v) for v in asset_values])]
        return out


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
            DataSourceBinding(_FixedSource(ohlc), ["close", "volume"]),
            DataSourceBinding(_FixedSource(basic), ["pe"]),
        ]
    )
    r = DependencyResolver(ds)

    out = r.get_panel(
        fields=["close", "pe"],
        start_date="2024-01-01",
        end_date="2024-01-31",
        instrument_codes=None,
        window=0,
    )
    assert list(out.columns) == ["close", "pe"]
    assert len(out) == 1
    assert float(out.iloc[0]["close"]) == 1.0
    assert float(out.iloc[0]["pe"]) == 100.0


def test_dependency_columns_read_as_strings_are_coerced_to_numeric() -> None:
    """CSV/read_csv often leaves price columns as object dtype; panel must be numeric."""
    df = pd.DataFrame(
        {
            "date": [pd.Timestamp("2024-01-02")],
            "asset": ["A"],
            "close": ["10.5"],
        }
    )
    ds = DataSet(
        [
            DataSourceBinding(_FixedSource(df), ["close"]),
        ]
    )
    r = DependencyResolver(ds)
    out = r.get_panel(
        fields=["close"],
        start_date="2024-01-01",
        end_date="2024-01-31",
        instrument_codes=None,
        window=0,
    )
    assert out["close"].dtype == "float64"
    assert float(out.iloc[0]["close"]) == 10.5


def test_register_datasource_alias_maps_physical_columns() -> None:
    """DatasourceBinding.alias is not applied for renaming in DataSet."""
    df = _panel([(pd.Timestamp("2024-01-02"), "A", 99.0)], ["close"])
    ds = DataSet(
        [
            DataSourceBinding(
                _FixedSource(df),
                ["close"],
            )
        ]
    )
    r = DependencyResolver(ds)
    out = r.get_panel(
        fields=["close"],
        start_date="2024-01-01",
        end_date="2024-01-31",
        instrument_codes=None,
        window=0,
    )
    assert list(out.columns) == ["close"]
    assert float(out.iloc[0]["close"]) == 99.0


def test_dependency_columns_multiple_fields() -> None:
    df = _panel([(pd.Timestamp("2024-01-02"), "A", 1.0, 2.0)], ["close", "open"])
    ds = DataSet(
        [
            DataSourceBinding(
                _FixedSource(df),
                ["close", "open"],
            )
        ]
    )
    r = DependencyResolver(ds)
    out = r.get_panel(
        fields=["close", "open"],
        start_date=None,
        end_date="2024-01-31",
        instrument_codes=None,
        window=0,
    )
    assert list(out.columns) == ["close", "open"]
    assert len(out) == 1
    assert float(out.iloc[0]["close"]) == 1.0
    assert float(out.iloc[0]["open"]) == 2.0


def test_unknown_field_raises() -> None:
    ds = DataSet(
        [
            DataSourceBinding(_FixedSource(_panel([], [])), ["close"]),
        ]
    )
    r = DependencyResolver(ds)
    with pytest.raises(ValueError, match="preprocessor output does not contain requested fields"):
        r.get_panel(
            fields=["nope"],
            start_date=None,
            end_date="2024-01-02",
            instrument_codes=None,
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
            instrument_codes=None,
            window=0,
        )
