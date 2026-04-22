from __future__ import annotations

import json

import pytest
from app.factors.registry import FactorItemsRegistry, read_source, resolve_source_path
from custom_code import validate_identifier_name as validate_factor_name
from custom_code import validate_source_syntax
from factor import Factor

MIN_SOURCE = "x = 1\n"

FACTOR_SOURCE_TEMPLATE = """from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class NewFactor(Factor):
    name = "{name}"
    group = "custom"
    description = ""
    max_window = 2

    def calc(self, close: pd.DataFrame) -> pd.Series:
        # Minimal implementation; this test only checks loading.
        return close.stack()
"""


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


def test_default_source(client):
    r = client.get("/factors/template")
    assert r.status_code == 200
    data = r.json()
    assert "source" in data
    assert "NewFactor" in data["source"]
    assert 'name = "my_factor"' in data["source"]

    r2 = client.get("/factors/template?name=alpha_demo")
    assert r2.status_code == 200
    assert 'name = "alpha_demo"' in r2.json()["source"]


def test_create_roundtrip_files(workspace_tmp, client):
    r = client.post(
        "/factors",
        json={
            "name": "alpha_one",
            "group": "g",
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

    cfg = workspace_tmp / "factors" / "registry.json"
    assert cfg.is_file()
    reg = json.loads(cfg.read_text(encoding="utf-8"))
    assert len(reg["items"]) == 1
    assert reg["items"][0]["id"] == fid

    py_path = workspace_tmp / "factors" / "source" / f"{fid}.py"
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

    rec = FactorItemsRegistry.list_items()[0]
    assert read_source(rec) == new_src
    assert resolve_source_path(rec.source_path).read_text(encoding="utf-8") == new_src

    r3 = client.delete(f"/factors/{fid}")
    assert r3.status_code == 204
    assert client.get("/factors").json() == []
    assert not resolve_source_path(rec.source_path).is_file()


def test_get_factor_loads_from_source(workspace_tmp, client):
    src = FACTOR_SOURCE_TEMPLATE.format(name="alpha_test")
    r = client.post(
        "/factors",
        json={
            "name": "alpha_test",
            "group": "custom",
            "description": "",
            "max_window": 2,
            "dependencies": ["close"],
            "source": src,
        },
    )
    assert r.status_code == 200, r.text
    fid = r.json()["id"]

    factor_cls = FactorItemsRegistry.get_factor(fid)
    assert factor_cls is not None
    assert isinstance(factor_cls, type)
    assert issubclass(factor_cls, Factor)
    assert factor_cls.name == "alpha_test"
