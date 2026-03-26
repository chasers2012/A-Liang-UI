"""Load an EvaluationMetric subclass from user source."""

from __future__ import annotations

import ast
from typing import Optional, Tuple, Type

import numpy as np
import pandas as pd
from evaluate import EvaluationMetric

from app.factors.loader import strip_markdown_fences


def _base_eval_metric_name(base: ast.expr) -> Optional[str]:
    if isinstance(base, ast.Subscript):
        return _base_eval_metric_name(base.value)
    if isinstance(base, ast.Name):
        return base.id
    if isinstance(base, ast.Attribute):
        return base.attr
    return None


def parse_metric_class_name(module_ast: ast.Module) -> Optional[str]:
    for node in module_ast.body:
        if isinstance(node, ast.ClassDef):
            for base in node.bases:
                if _base_eval_metric_name(base) == "EvaluationMetric":
                    return node.name
    return None


METRIC_GLOBALS = {
    "np": np,
    "pd": pd,
    "EvaluationMetric": EvaluationMetric,
}


def load_evaluation_metric_class(source: str) -> Tuple[Type[EvaluationMetric], str]:
    cleaned = strip_markdown_fences(source)
    tree = ast.parse(cleaned)
    class_name = parse_metric_class_name(tree)
    if not class_name:
        raise ValueError("源码中未找到继承 EvaluationMetric 的类")

    ns = dict(METRIC_GLOBALS)
    exec(compile(tree, filename="<evaluation_metric>", mode="exec"), ns, ns)
    cls = ns.get(class_name)
    if cls is None or not isinstance(cls, type) or not issubclass(cls, EvaluationMetric):
        raise ValueError(f"{class_name} 不是有效的 EvaluationMetric 子类")
    return cls, class_name
