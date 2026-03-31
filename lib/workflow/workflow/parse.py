import ast
import functools
import inspect

import workflow as workflow_lib
from workflow import NodeParam, NodeParamModel


def _safe_literal(node: ast.AST | None) -> object | None:
    if node is None:
        return None
    try:
        return ast.literal_eval(node)
    except (TypeError, ValueError):
        return None


def _call_name(call: ast.Call) -> str:
    func = call.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return ""


@functools.lru_cache(maxsize=1)
def _param_ctor_specs() -> dict[str, tuple[list[str], str | None]]:
    specs: dict[str, tuple[list[str], str | None]] = {}

    for obj in vars(workflow_lib).values():
        if isinstance(obj, type) and issubclass(obj, NodeParam) and obj is not NodeParam:
            sig = inspect.signature(obj)
            fields = [
                name
                for name, p in sig.parameters.items()
                if p.kind
                in (
                    inspect.Parameter.POSITIONAL_ONLY,
                    inspect.Parameter.POSITIONAL_OR_KEYWORD,
                    inspect.Parameter.KEYWORD_ONLY,
                )
            ]
            inferred_type: str | None
            try:
                inferred_type = str(obj("tmp_key").type)
            except Exception:
                inferred_type = None
            specs[obj.__name__] = (fields, inferred_type)

    model_sig = inspect.signature(NodeParamModel)
    model_fields = [
        name
        for name, p in model_sig.parameters.items()
        if p.kind
        in (
            inspect.Parameter.POSITIONAL_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.KEYWORD_ONLY,
        )
    ]
    specs[NodeParamModel.__name__] = (model_fields, None)
    return specs


def _parse_param_call(call: ast.Call) -> NodeParamModel | None:
    spec = _param_ctor_specs().get(_call_name(call))
    if spec is None:
        return None
    fields, inferred_type = spec

    data: dict[str, object] = {}
    for idx, arg in enumerate(call.args[: len(fields)]):
        val = _safe_literal(arg)
        if val is not None:
            data[fields[idx]] = val

    for kw in call.keywords:
        if kw.arg is None:
            continue
        val = _safe_literal(kw.value)
        if val is not None:
            data[kw.arg] = val

    if inferred_type is not None:
        data.setdefault("type", inferred_type)
    if "key" not in data:
        return None
    return NodeParamModel.model_validate(data)


def _parse_workflow_parameters(node: ast.AST | None) -> list[NodeParamModel]:
    if not isinstance(node, (ast.List, ast.Tuple)):
        return []
    out: list[NodeParamModel] = []
    for elem in node.elts:
        if not isinstance(elem, ast.Call):
            continue
        item = _parse_param_call(elem)
        if item is not None:
            out.append(item)
    return out


def parse_workflow_node_source(source: str) -> tuple[str, str, list[NodeParamModel], str]:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        for deco in node.decorator_list:
            if not isinstance(deco, ast.Call) or _call_name(deco) != "workflow_node":
                continue
            kwargs = {kw.arg: kw.value for kw in deco.keywords if kw.arg is not None}
            name = str(_safe_literal(kwargs.get("label")) or "").strip()
            description = str(_safe_literal(kwargs.get("description")) or "").strip()
            workflow_parameters = _parse_workflow_parameters(kwargs.get("workflow_parameters"))
            return name, description, workflow_parameters, source

    raise ValueError("source 中未找到 @workflow_node(...) 装饰器")
