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


def _parse_call_args_kwargs(call: ast.Call) -> tuple[list[object], dict[str, object]] | None:
    """Parse literal-evaluable args/kwargs for a constructor call.

    - Positional args must all be literal-evaluable; otherwise we can't preserve order safely.
    - Keyword args are included only when literal-evaluable.
    """
    args: list[object] = []
    for a in call.args:
        val = _safe_literal(a)
        if val is None:
            return None
        args.append(val)

    kwargs: dict[str, object] = {}
    for kw in call.keywords:
        if kw.arg is None:
            continue
        val = _safe_literal(kw.value)
        if val is None:
            continue
        kwargs[kw.arg] = val
    return args, kwargs


@functools.lru_cache(maxsize=1)
def _socket_ctor_map() -> dict[str, type[Socket]]:
    ctors: dict[str, type[Socket]] = {}
    for obj in vars(workflow_lib).values():
        if isinstance(obj, type) and issubclass(obj, Socket):
            ctors[obj.__name__] = obj
    # 兜底：确保基础类名始终可用
    ctors.setdefault("Socket", Socket)
    return ctors


def _parse_socket_call(call: ast.Call) -> Socket | None:
    ctor = _socket_ctor_map().get(_call_name(call))
    if ctor is None:
        return None

    parsed = _parse_call_args_kwargs(call)
    if parsed is None:
        return None
    args, kwargs = parsed

    # 最小校验：必须能解析出 name（否则忽略该 socket 定义）
    name: object | None = kwargs.get("name") if "name" in kwargs else (args[0] if args else None)
    if not isinstance(name, str) or not name.strip():
        return None

    try:
        return ctor(*args, **kwargs)
    except TypeError:
        # 兼容：某些 Socket 子类签名不接受我们透传的全部参数时，回退到标准三元组
        base_name, base_required, base_value_type = _parse_socket_positional(call)
        base_name, base_required, base_value_type = _parse_socket_keywords(
            call,
            name=base_name,
            required=base_required,
            value_type=base_value_type,
        )
        if not base_name:
            return None
        try:
            return ctor(name=base_name, required=base_required, value_type=base_value_type)
        except TypeError:
            return ctor(base_name, base_required, base_value_type)


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
) -> tuple[str, str, list[Socket], list[Socket]]:
    """Parse a workflow-node python source snippet by instantiating its decorated class.

    Note: this executes *source* to recover runtime metadata produced by the
    ``@workflow_node(...)`` decorator (including Socket subclasses and custom kwargs).
    """
    tree = ast.parse(source)

    # Keep original class definition order so we can deterministically pick the first
    # workflow-node-decorated class in source.
    class_names_in_order: list[str] = [n.name for n in tree.body if isinstance(n, ast.ClassDef)]

    module_name = "__workflow_node_source__"
    glb: dict[str, object] = {"__name__": module_name}
    loc: dict[str, object] = {}
    exec(compile(tree, filename=module_name, mode="exec"), glb, loc)

    env: dict[str, object] = {**glb, **loc}

    def _is_workflow_node_class(obj: object) -> bool:
        if not isinstance(obj, type):
            return False
        if not issubclass(obj, workflow_lib.Node):
            return False
        # Decorator stores type-definition fields as class attributes.
        return (
            getattr(obj, "__module__", None) == module_name
            and isinstance(getattr(obj, "label", None), str)
            and isinstance(getattr(obj, "description", None), str)
            and getattr(obj, "inputs", None) is not None
            and getattr(obj, "outputs", None) is not None
        )

    workflow_classes: dict[str, type] = {
        name: obj for name, obj in env.items() if name and _is_workflow_node_class(obj)
    }

    picked: type | None = None
    for name in class_names_in_order:
        cls = workflow_classes.get(name)
        if cls is not None:
            picked = cls
            break
    if picked is None and workflow_classes:
        # Fallback: any one workflow node class found in this snippet.
        picked = next(iter(workflow_classes.values()))
    if picked is None:
        raise ValueError("source 中未找到 @workflow_node(...) 装饰的类")

    try:
        node_obj = picked()  # type: ignore[call-arg]
    except Exception:
        # Some node classes define a required __init__; we only need class-level metadata.
        node_obj = picked.__new__(picked)  # type: ignore[misc]

    label = str(getattr(node_obj, "label", "") or "").strip()
    description = str(getattr(node_obj, "description", "") or "").strip()
    inputs = list(getattr(node_obj, "inputs", ()) or ())
    outputs = list(getattr(node_obj, "outputs", ()) or ())
    return label, description, inputs, outputs
