from datasources import SqlDataSource
from factor import DataSet, DataSourceBinding
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
    )
    dataset = DataSet(
        [
            DataSourceBinding(
                ds,
                dependencies=["close"],
                alias={"close": "c"},
                date_column="d",
                asset_column="sym",
            )
        ]
    )
    df = dataset.get_panel(
        fields=["close"],
        start_date="2025-01-02",
        end_date="2025-01-03",
        instrument_codes=None,
        window=0,
    )
    assert df.index.names == ("date", "asset")
    assert list(df.columns) == ["close"]
    assert len(df) == 2
    assert float(df.loc[("2025-01-03", "AAA"), "close"]) == 11.0


def test_sql_data_source_list_columns():
    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE bars (d TEXT, sym TEXT, c REAL, v REAL)"))
        conn.commit()
    ds = SqlDataSource(
        engine,
        table="bars",
    )
    assert ds.list_columns() == ["c", "d", "sym", "v"]
