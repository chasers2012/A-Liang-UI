from sql_datasource import SqlDataSource
from sqlalchemy import create_engine, text


def test_sql_data_source_sqlite_panel():
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE bars (d TEXT, sym TEXT, c REAL)"))
        conn.execute(
            text("INSERT INTO bars VALUES ('2025-01-02','AAA',10.0),('2025-01-03','AAA',11.0)")
        )
        conn.commit()

    ds = SqlDataSource(
        engine,
        table="bars",
        date_column="d",
        asset_column="sym",
        column_map={"close": "c"},
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
