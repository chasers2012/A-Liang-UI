import ast
import functools
import inspect
from dataclasses import dataclass

import workflow as workflow_lib
from workflow import NodeParam, NodeParamModel, Socket


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


@dataclass(frozen=True)
class _ParamCtorSpec:
    fields: list[str]
    inferred_type: str | None


@functools.lru_cache(maxsize=1)
def _param_ctor_specs() -> dict[str, _ParamCtorSpec]:
    specs: dict[str, _ParamCtorSpec] = {}

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
            specs[obj.__name__] = _ParamCtorSpec(fields=fields, inferred_type=inferred_type)

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
    specs[NodeParamModel.__name__] = _ParamCtorSpec(fields=model_fields, inferred_type=None)
    return specs


def _parse_param_call(call: ast.Call) -> NodeParamModel | None:
    spec = _param_ctor_specs().get(_call_name(call))
    if spec is None:
        return None
    fields = spec.fields
    inferred_type = spec.inferred_type

    data: dict[str, object] = {}

    # 位置参数按签名顺序映射到字段
    for idx, arg in enumerate(call.args[: len(fields)]):
        val = _safe_literal(arg)
        if val is not None:
            data[fields[idx]] = val

    # 关键字参数按名称覆盖/补充
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
    allowed = {"key", "label", "type", "default", "minimum", "maximum"}
    kwargs = {k: v for k, v in data.items() if k in allowed}
    return NodeParamModel(**kwargs)


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


def _literal_str(node: ast.AST | None) -> str | None:
    val = _safe_literal(node)
    return val if isinstance(val, str) else None


def _literal_bool(node: ast.AST | None) -> bool | None:
    val = _safe_literal(node)
    return val if isinstance(val, bool) else None


def _parse_socket_positional(call: ast.Call) -> tuple[str | None, bool, str]:
    # positional args: name, required, value_type
    name = _literal_str(call.args[0]) if len(call.args) > 0 else None
    required_val = _literal_bool(call.args[1]) if len(call.args) > 1 else None
    required = required_val if required_val is not None else False
    value_type = _literal_str(call.args[2]) if len(call.args) > 2 else None
    return name, required, value_type or "any"


def _parse_socket_keywords(
    call: ast.Call, name: str | None, required: bool, value_type: str
) -> tuple[str | None, bool, str]:
    for kw in call.keywords:
        if kw.arg is None:
            continue
        val = _safe_literal(kw.value)
        if val is None:
            continue
        if kw.arg == "name" and isinstance(val, str):
            name = val
        elif kw.arg == "required" and isinstance(val, bool):
            required = val
        elif kw.arg == "value_type" and isinstance(val, str):
            value_type = val
    return name, required, value_type


def _parse_socket_call(call: ast.Call) -> Socket | None:
    if _call_name(call) != "Socket":
        return None

    name, required, value_type = _parse_socket_positional(call)
    name, required, value_type = _parse_socket_keywords(
        call, name=name, required=required, value_type=value_type
    )
    if not name:
        return None
    return Socket(name=name, required=required, value_type=value_type)


def _parse_sockets(node: ast.AST | None) -> list[Socket]:
    if not isinstance(node, (ast.List, ast.Tuple)):
        return []

    out: list[Socket] = []
    for elem in node.elts:
        if not isinstance(elem, ast.Call):
            continue
        item = _parse_socket_call(elem)
        if item is not None:
            out.append(item)
    return out


def parse_workflow_node_source(
    source: str,
) -> tuple[str, str, list[NodeParamModel], list[Socket], list[Socket], str]:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        for deco in node.decorator_list:
            if not isinstance(deco, ast.Call):
                continue
            if _call_name(deco) != "workflow_node":
                continue

            kwargs = {kw.arg: kw.value for kw in deco.keywords if kw.arg is not None}
            name = str(_safe_literal(kwargs.get("label")) or "").strip()
            description = str(_safe_literal(kwargs.get("description")) or "").strip()
            workflow_parameters = _parse_workflow_parameters(kwargs.get("workflow_parameters"))
            inputs = _parse_sockets(kwargs.get("input_sockets"))
            outputs = _parse_sockets(kwargs.get("output_sockets"))
            return name, description, workflow_parameters, inputs, outputs, source

    raise ValueError("source 中未找到 @workflow_node(...) 装饰器")
