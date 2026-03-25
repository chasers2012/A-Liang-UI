from pathlib import Path

import pytest

from datasource_csv import CsvFactorDataSource


def test_csv_factor_data_source_wrong_column_names(tmp_path: Path):
    p = tmp_path / "bars.csv"
    p.write_text(
        "date,asset,close\n"
        "2025-01-02,AAA,1\n",
        encoding="utf-8",
    )
    ds = CsvFactorDataSource(
        p,
        date_column="d",
        asset_column="sym",
        column_map={"close": "c"},
    )
    with pytest.raises(ValueError, match="Missing in file"):
        ds.get_panel(
            fields=["close"],
            start_date="2025-01-02",
            end_date="2025-01-02",
            stock_codes=None,
            window=0,
        )


def test_csv_factor_data_source_panel(tmp_path: Path):
    p = tmp_path / "bars.csv"
    p.write_text(
        "d,sym,c\n"
        "2025-01-02,AAA,10.0\n"
        "2025-01-03,AAA,11.0\n",
        encoding="utf-8",
    )

    ds = CsvFactorDataSource(
        p,
        date_column="d",
        asset_column="sym",
        column_map={"close": "c"},
    )
    df = ds.get_panel(
        fields=["close"],
        start_date="2025-01-03",
        end_date="2025-01-03",
        stock_codes=None,
        window=1,
    )
    assert df.index.names == ("date", "asset")
    assert list(df.columns) == ["close"]
    assert len(df) == 2
    assert float(df.loc[("2025-01-03", "AAA"), "close"]) == 11.0


def test_csv_factor_data_source_stock_codes_filter(tmp_path: Path):
    p = tmp_path / "bars.csv"
    p.write_text(
        "date,asset,close\n"
        "2025-01-02,AAA,1\n"
        "2025-01-02,BBB,2\n",
        encoding="utf-8",
    )
    ds = CsvFactorDataSource(p, date_column="date", asset_column="asset")
    df = ds.get_panel(
        fields=["close"],
        start_date="2025-01-02",
        end_date="2025-01-02",
        stock_codes=["BBB"],
        window=0,
    )
    assert len(df) == 1
    assert float(df.loc[("2025-01-02", "BBB"), "close"]) == 2.0
