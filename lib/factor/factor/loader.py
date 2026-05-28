"""Load a Factor subclass from user-written Python source."""

from __future__ import annotations

import sys
import types
import uuid
from typing import Any

import numpy as np
import pandas as pd
from custom_code import Inheritance

from factor.factor import Factor

FACTOR_GLOBALS: dict[str, object] = {
    "np": np,
    "pd": pd,
    "Factor": Factor,
}

_inheritance = Inheritance(Factor)


def is_valid_factor_class(source: str) -> tuple[type[Factor], str]:
    return _inheritance.is_valid_subclass(source)


def load_factor_instance_from_source(source: str, *, module_name: str | None = None) -> Factor:
    """
    Execute *source* and instantiate the first discovered ``Factor`` subclass.

    Notes:
    - This is intended for extracting metadata (e.g. ``name``, ``group``, dependencies).
    - The executed module is registered in ``sys.modules`` to support common patterns
      (e.g. relative imports / introspection); callers may pass an explicit *module_name*.
    """
    source_text = str(source or "").strip()
    if not source_text:
        raise ValueError("source 不能为空")

    try:
        code = compile(source_text, "<factor_source>", "exec")
    except SyntaxError as exc:
        raise ValueError(f"source 语法错误: {exc.msg}") from exc

    mod_name = module_name or f"_a_liang_ui_inline_factor_{uuid.uuid4().hex}"
    module = types.ModuleType(mod_name)
    sys.modules[mod_name] = module

    try:
        exec(code, module.__dict__)
    except Exception as exc:
        raise ValueError(f"source 执行失败: {exc}") from exc

    candidates = [
        obj
        for obj in module.__dict__.values()
        if isinstance(obj, type) and issubclass(obj, Factor) and obj is not Factor
    ]
    if not candidates:
        raise ValueError("source 中未找到 Factor 子类。")

    factor_cls: type[Factor] = candidates[0]
    for c in candidates:
        n = getattr(c, "name", None)
        if isinstance(n, str) and n.strip():
            factor_cls = c
            break

    try:
        return factor_cls()
    except Exception as exc:
        raise ValueError(f"无法实例化因子类: {exc}") from exc


def parse_factor_meta_from_source(
    source: str,
) -> tuple[str, str, str, list[str], tuple[dict[str, Any], ...]]:
    factor = load_factor_instance_from_source(source)
    name = str(getattr(factor, "name", "") or "").strip()
    group = str(getattr(factor, "group", "factor") or "factor").strip() or "factor"
    description = str(getattr(factor, "description", "") or "").strip()
    dependencies = factor.dependency_fields()
    param_specs = factor.get_param_specs()
    return name, group, description, dependencies, param_specs


__all__ = [
    "FACTOR_GLOBALS",
    "is_valid_factor_class",
    "load_factor_instance_from_source",
    "parse_factor_meta_from_source",
]
