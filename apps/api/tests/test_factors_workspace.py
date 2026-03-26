from __future__ import annotations

import json

import pytest

from app.factor_registry import load_registry, read_source, resolve_source_path
from app.factor_validate import validate_factor_name, validate_source_syntax


MIN_SOURCE = "x = 1\n"


def test_validate_factor_name_ok():
    validate_factor_name("mom_10d")


def test_validate_factor_name_bad():
    with pytest.raises(ValueError, match="标识符"):
        validate_factor_name("123bad")
    with pytest.raises(ValueError, match="关键字"):
        validate_factor_name("class")


def test_validate_source_syntax():
    validate_source_syntax("a = 1\n")
    with pytest.raises(ValueError, match="语法"):
        validate_source_syntax("def bad(")


def test_list_empty(client):
    r = client.get("/factors")
    assert r.status_code == 200
    assert r.json() == []


def test_create_roundtrip_files(workspace_tmp, client):
    r = client.post(
        "/factors",
        json={
            "name": "alpha_one",
            "group": "g",
            "group_label": "G",
            "description": "d",
            "max_window": 3,
            "dependencies": ["close", "volume"],
            "source": MIN_SOURCE,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "alpha_one"
    assert data["dependencies"] == ["close", "volume"]
    assert data["source"] == MIN_SOURCE
    fid = data["id"]

    cfg = workspace_tmp / "config" / "factors.json"
    assert cfg.is_file()
    reg = json.loads(cfg.read_text(encoding="utf-8"))
    assert len(reg["items"]) == 1
    assert reg["items"][0]["id"] == fid

    py_path = workspace_tmp / "factors" / f"{fid}.py"
    assert py_path.is_file()
    assert py_path.read_text(encoding="utf-8") == MIN_SOURCE

    r2 = client.get(f"/factors/{fid}")
    assert r2.status_code == 200
    assert r2.json()["source"] == MIN_SOURCE


def test_create_bad_name(client):
    r = client.post(
        "/factors",
        json={
            "name": "not-valid!",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r.status_code == 400


def test_create_syntax_error(client):
    r = client.post(
        "/factors",
        json={
            "name": "okname",
            "max_window": 2,
            "dependencies": ["close"],
            "source": "def x(",
        },
    )
    assert r.status_code == 400


def test_patch_and_delete(workspace_tmp, client):
    r = client.post(
        "/factors",
        json={
            "name": "to_patch",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r.status_code == 200
    fid = r.json()["id"]

    new_src = "y = 2\n"
    r2 = client.patch(
        f"/factors/{fid}",
        json={"source": new_src, "description": "Patched"},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["description"] == "Patched"
    assert r2.json()["source"] == new_src

    rec = load_registry().items[0]
    assert read_source(rec) == new_src
    assert resolve_source_path(rec.source_path).read_text(encoding="utf-8") == new_src

    r3 = client.delete(f"/factors/{fid}")
    assert r3.status_code == 204
    assert client.get("/factors").json() == []
    assert not resolve_source_path(rec.source_path).is_file()
