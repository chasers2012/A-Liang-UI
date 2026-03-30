from __future__ import annotations

import ast
import shutil
from collections.abc import Callable
from typing import Any

from custom_code import Inheritance, SourceFiles
from custom_code.subclass_loader import direct_base_symbol_name, strip_markdown_fences
from evaluate.evaluation_metric import EvaluationMetric
from evaluate.metric_loader import METRIC_GLOBALS
from workspace import workspace_path


def _build_loader_globals_and_base_ast() -> tuple[dict[str, object], frozenset[str]]:
    """Build exec globals + acceptable base class names for AST scanning."""
    globals_: dict[str, object] = {
        **METRIC_GLOBALS,
    }
    base_ast = frozenset({"EvaluationMetric"})
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


class EvaluationMetricPackageManager:
    """
    User evaluation metric "package management" + workflow-type -> metric-id mapping.

    Encapsulates:
    - scaffold user metric python package under `workflow_nodes/evaluation/`
    - load/validate user metric class source
    - resolve metric ids from workflow node type FQN
    """

    USER_METRIC_WORKFLOW_ROOT: str = "workflow_nodes/evaluation"

    @staticmethod
    def get_package_dir(metric_id: str) -> str:
        return f"em_{metric_id.replace('-', '_')}"

    @staticmethod
    def get_source_path(metric_id: str) -> str:
        return (
            f"{EvaluationMetricPackageManager.USER_METRIC_WORKFLOW_ROOT}/"
            f"{EvaluationMetricPackageManager.get_package_dir(metric_id)}/metric_node.py"
        )

    @staticmethod
    def write_metric_package(
        metric_id: str,
        source: str,
        *,
        validators: list[Callable[[str], None]] | None = None,
    ) -> None:
        """Create package dir, `metric_node.py`."""
        pkg_dir = EvaluationMetricPackageManager.get_package_dir(metric_id)
        source_path = EvaluationMetricPackageManager.get_source_path(metric_id)

        pkg_root = workspace_path(
            "workflow_nodes",
            "evaluation",
            pkg_dir,
        )
        pkg_root.mkdir(parents=True, exist_ok=True)
        SourceFiles.write_source_text(source_path, source, validators=validators)

    @staticmethod
    def delete_user_metric_package(metric_id: str) -> None:
        pkg_dir = EvaluationMetricPackageManager.get_package_dir(metric_id)
        pkg_root = workspace_path("workflow_nodes", "evaluation", pkg_dir)
        if pkg_root.is_dir():
            shutil.rmtree(pkg_root, ignore_errors=True)

    @staticmethod
    def load_user_evaluation_metric_class(source: str) -> tuple[type[EvaluationMetric], str]:
        cleaned = strip_markdown_fences(source)
        tree = ast.parse(cleaned)
        class_name = _pick_class_name(tree)
        if not class_name:
            raise ValueError(_inheritance.missing_message)
        ns: dict[str, Any] = dict(_GLOBALS)
        exec(compile(tree, filename=_inheritance.exec_filename, mode="exec"), ns, ns)
        cls = ns.get(class_name)
        if cls is None or not isinstance(cls, type) or not issubclass(cls, EvaluationMetric):
            raise ValueError(
                _inheritance.invalid_message(class_name)
                if callable(_inheritance.invalid_message)
                else _inheritance.invalid_message
            )
        return cls, class_name
