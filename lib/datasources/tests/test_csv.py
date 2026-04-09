from pathlib import Path

import pytest
from datasources import CsvDataSource


def test_csv_data_source_wrong_column_names(tmp_path: Path):
    p = tmp_path / "bars.csv"
    p.write_text(
        "date,asset,close\n2025-01-02,AAA,1\n",
        encoding="utf-8",
    )
    ds = CsvDataSource(
        p,
        date_column="d",
        asset_column="sym",
    )
    with pytest.raises(ValueError, match="Missing in file"):
        ds.get_panel(
            fields=["close"],
            start_date="2025-01-02",
            end_date="2025-01-02",
            stock_codes=None,
        )


def test_csv_data_source_panel(tmp_path: Path):
    p = tmp_path / "bars.csv"
    p.write_text(
        "d,sym,close\n2025-01-02,AAA,10.0\n2025-01-03,AAA,11.0\n",
        encoding="utf-8",
    )

    ds = CsvDataSource(
        p,
        date_column="d",
        asset_column="sym",
    )
    df = ds.get_panel(
        fields=["close"],
        start_date="2025-01-02",
        end_date="2025-01-03",
        stock_codes=None,
    )
    assert df.index.names == ("date", "asset")
    assert list(df.columns) == ["close"]
    assert len(df) == 2
    assert float(df.loc[("2025-01-03", "AAA"), "close"]) == 11.0


def test_csv_data_source_stock_codes_filter(tmp_path: Path):
    p = tmp_path / "bars.csv"
    p.write_text(
        "date,asset,close\n2025-01-02,AAA,1\n2025-01-02,BBB,2\n",
        encoding="utf-8",
    )
    ds = CsvDataSource(p, date_column="date", asset_column="asset")
    df = ds.get_panel(
        fields=["close"],
        start_date="2025-01-02",
        end_date="2025-01-02",
        stock_codes=["BBB"],
    )
    assert len(df) == 1
    assert float(df.loc[("2025-01-02", "BBB"), "close"]) == 2.0


def test_csv_data_source_list_columns(tmp_path: Path) -> None:
    p = tmp_path / "bars.csv"
    p.write_text(
        "date,asset,close,volume\n2025-01-02,AAA,1,10\n",
        encoding="utf-8",
    )
    ds = CsvDataSource(p, date_column="date", asset_column="asset")
    assert ds.list_columns() == ["close", "volume"]
