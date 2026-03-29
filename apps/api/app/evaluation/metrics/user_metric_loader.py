"""Load user evaluation metric source (supports RegistryUserEvaluationMetric)."""

from __future__ import annotations

import ast

from custom_code import Inheritance
from custom_code.subclass_loader import direct_base_symbol_name, strip_markdown_fences
from evaluate.evaluation_metric import EvaluationMetric
from evaluate.metric_loader import METRIC_GLOBALS

from app.evaluation.metrics.user_metric_workflow import RegistryUserEvaluationMetric


def _build_loader_globals_and_base_ast() -> tuple[dict[str, object], frozenset[str]]:
    """Build exec globals + acceptable base class names for AST scanning."""
    globals_ = {
        **METRIC_GLOBALS,
        "RegistryUserEvaluationMetric": RegistryUserEvaluationMetric,
    }
    base_ast = frozenset(
        {
            "EvaluationMetric",
            "MeanInformationCoefficientMetric",
            "MeanReturnSpreadMetric",
            "RegistryUserEvaluationMetric",
        }
    )
    return globals_, base_ast


_GLOBALS, _BASE_AST = _build_loader_globals_and_base_ast()


def _pick_class_name(module_ast: ast.Module) -> str | None:
    """Pick the concrete metric class name from a user-provided module."""
    preferred: list[str] = []
    fallback: list[str] = []
    for node in module_ast.body:
        if not isinstance(node, ast.ClassDef):
            continue
        syms: set[str] = set()
        for base in node.bases:
            sym = direct_base_symbol_name(base)
            if sym:
                syms.add(sym)
        if "RegistryUserEvaluationMetric" in syms:
            preferred.append(node.name)
        elif syms & _BASE_AST:
            fallback.append(node.name)
    if preferred:
        return preferred[-1]
    return fallback[0] if fallback else None


_inheritance = Inheritance(
    EvaluationMetric,
    _GLOBALS,
    exec_filename="<evaluation_metric>",
    missing_message="源码中未找到继承 EvaluationMetric 的类",
    invalid_message=lambda n: f"{n} 不是有效的 EvaluationMetric 子类",
    base_ast_names=_BASE_AST,
)


def load_user_evaluation_metric_class(source: str) -> tuple[type[EvaluationMetric], str]:
    cleaned = strip_markdown_fences(source)
    tree = ast.parse(cleaned)
    class_name = _pick_class_name(tree)
    if not class_name:
        raise ValueError(_inheritance.missing_message)
    ns = dict(_GLOBALS)
    exec(compile(tree, filename=_inheritance.exec_filename, mode="exec"), ns, ns)
    cls = ns.get(class_name)
    if cls is None or not isinstance(cls, type) or not issubclass(cls, EvaluationMetric):
        raise ValueError(
            _inheritance.invalid_message(class_name)
            if callable(_inheritance.invalid_message)
            else _inheritance.invalid_message
        )
    return cls, class_name
