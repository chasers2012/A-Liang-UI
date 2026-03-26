from __future__ import annotations

import json

from fastapi.testclient import TestClient

MIN_SOURCE = "x = 1\n"


def test_snapshots_empty_after_create(client):
    r = client.post(
        "/factors",
        json={
            "name": "snap_a",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r.status_code == 200
    fid = r.json()["id"]
    r2 = client.get(f"/factors/{fid}/snapshots")
    assert r2.status_code == 200
    assert r2.json() == []


def test_patch_source_appends_auto_snapshot(client, workspace_tmp):
    r = client.post(
        "/factors",
        json={
            "name": "snap_b",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    fid = r.json()["id"]

    r2 = client.patch(
        f"/factors/{fid}",
        json={"source": "y = 2\n"},
    )
    assert r2.status_code == 200, r2.text

    r3 = client.get(f"/factors/{fid}/snapshots")
    assert r3.status_code == 200
    snaps = r3.json()
    assert len(snaps) == 1
    assert snaps[0]["kind"] == "auto"
    assert snaps[0]["meta"]["name"] == "snap_b"

    r4 = client.patch(f"/factors/{fid}", json={"source": "y = 2\n"})
    assert r4.status_code == 200
    r5 = client.get(f"/factors/{fid}/snapshots")
    assert len(r5.json()) == 1


def test_get_snapshot_detail(client):
    r = client.post(
        "/factors",
        json={
            "name": "snap_d",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    fid = r.json()["id"]
    client.patch(f"/factors/{fid}", json={"source": "a = 1\n"})
    r_list = client.get(f"/factors/{fid}/snapshots")
    sid = r_list.json()[0]["id"]
    r3 = client.get(f"/factors/{fid}/snapshots/{sid}")
    assert r3.status_code == 200
    assert r3.json()["source"] == "a = 1\n"


def test_evaluation_history_linked_on_patch(client, workspace_tmp):
    r = client.post(
        "/factors",
        json={
            "name": "snap_e",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    fid = r.json()["id"]

    eval_path = workspace_tmp / "config" / "factor_evaluations.json"
    eval_path.write_text(
        json.dumps(
            {
                "version": 1,
                "items": {
                    fid: {
                        "evaluated_at": "2025-01-01T00:00:00+00:00",
                        "mean_ic": {"5": 0.03},
                        "mean_return_spread": {},
                        "error": None,
                    },
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    r2 = client.patch(f"/factors/{fid}", json={"source": "z = 3\n"})
    assert r2.status_code == 200, r2.text

    r3 = client.get(f"/factors/{fid}/evaluations/history")
    assert r3.status_code == 200
    hist = r3.json()
    assert len(hist) == 1
    assert hist[0]["mean_ic"]["5"] == 0.03
    assert hist[0]["linked_snapshot_id"] is not None

    r4 = client.get(f"/factors/{fid}/snapshots")
    snap_id = r4.json()[0]["id"]
    assert hist[0]["linked_snapshot_id"] == snap_id


def test_trim_prefers_dropping_auto(monkeypatch, client):
    import app.factors.code_snapshots_store as cs

    monkeypatch.setattr(cs, "MAX_SNAPSHOTS_PER_FACTOR", 3)
    monkeypatch.setattr(cs, "MAX_SNAPSHOTS_HARD_CAP", 5)

    r = client.post(
        "/factors",
        json={
            "name": "snap_f",
            "max_window": 2,
            "dependencies": ["close"],
            "source": "v0\n",
        },
    )
    fid = r.json()["id"]
    for i in range(1, 7):
        client.patch(f"/factors/{fid}", json={"source": f"v{i}\n"})

    r2 = client.get(f"/factors/{fid}/snapshots")
    rows = r2.json()
    assert len(rows) == 3
    assert all(row["kind"] == "auto" for row in rows)
    assert rows[0]["meta"]["name"] == "snap_f"


def test_delete_factor_clears_snapshots_and_history(client, workspace_tmp):
    r = client.post(
        "/factors",
        json={
            "name": "snap_g",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    fid = r.json()["id"]
    client.patch(f"/factors/{fid}", json={"source": "a = 1\n"})

    hist_path = workspace_tmp / "config" / "factor_evaluation_history.json"
    hist_path.write_text(
        json.dumps(
            {
                "version": 1,
                "items": {fid: []},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    client.patch(f"/factors/{fid}", json={"source": "b = 2\n"})

    r2 = client.delete(f"/factors/{fid}")
    assert r2.status_code == 204

    snap_file = workspace_tmp / "config" / "factor_code_snapshots.json"
    if snap_file.is_file():
        data = json.loads(snap_file.read_text(encoding="utf-8"))
        assert fid not in data.get("factors", {})
