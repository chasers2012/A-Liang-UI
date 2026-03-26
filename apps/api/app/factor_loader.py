"""Load a Factor subclass from user source (same rules as agent.codegen)."""

from __future__ import annotations

import ast
import re
from typing import Optional, Tuple, Type

import numpy as np
import pandas as pd
from factor.factor import Factor


def strip_markdown_fences(src: str) -> str:
    s = src.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9]*\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def parse_factor_class_name(module_ast: ast.Module) -> Optional[str]:
    for node in module_ast.body:
        if isinstance(node, ast.ClassDef):
            for base in node.bases:
                name: Optional[str] = None
                if isinstance(base, ast.Name):
                    name = base.id
                elif isinstance(base, ast.Attribute):
                    name = base.attr
                if name == "Factor":
                    return node.name
    return None


FACTOR_GLOBALS = {
    "np": np,
    "pd": pd,
    "Factor": Factor,
}


def load_factor_class(source: str) -> Tuple[Type[Factor], str]:
    cleaned = strip_markdown_fences(source)
    tree = ast.parse(cleaned)
    class_name = parse_factor_class_name(tree)
    if not class_name:
        raise ValueError("源码中未找到继承 Factor 的类")

    ns = dict(FACTOR_GLOBALS)
    exec(compile(tree, filename="<factor>", mode="exec"), ns, ns)
    cls = ns.get(class_name)
    if cls is None or not isinstance(cls, type) or not issubclass(cls, Factor):
        raise ValueError(f"{class_name} 不是有效的 Factor 子类")
    return cls, class_name
