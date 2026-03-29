"""Tests for :mod:`workflow.node_types` (``NodeParamModel``, etc.)."""

from __future__ import annotations

import pytest
from workflow import NodeParamModel, validate_node_param_list


def test_validate_node_param_list_rejects_duplicate_keys() -> None:
    a = NodeParamModel(key="x", type="number")
    b = NodeParamModel(key="x", type="string")
    with pytest.raises(ValueError, match="重复"):
        validate_node_param_list([a, b])


def test_node_param_model_accepts_shape() -> None:
    m = NodeParamModel(key="alpha", label="A", type="string", default="")
    assert m.key == "alpha"
