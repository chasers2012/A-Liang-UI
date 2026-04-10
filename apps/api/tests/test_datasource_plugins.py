from __future__ import annotations


def test_create_datasource_rejects_invalid_sql_config(client):
    # Missing db_host/db_name/table -> SQL plugin validation error
    r = client.post(
        "/datasources",
        json={
            "name": "bad",
            "type": "sql",
            "config": {},
        },
    )
    assert r.status_code == 400
