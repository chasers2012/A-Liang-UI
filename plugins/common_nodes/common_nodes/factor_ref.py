from __future__ import annotations

from typing import Any

import pandas as pd
from app.factors.controller import get_factor
from app.factors.registry import FactorItemsRegistry
from workflow import Socket, workflow_node
from workflow.node_types import RJSFNodeParam


def _factor_ref_options() -> list[dict[str, str]]:
    items = FactorItemsRegistry.list_items()
    options = [
        {"label": (getattr(f, "name", "") or str(getattr(f, "id", ""))), "value": str(f.id)}
        for f in items
    ]
    out = [o for o in options if o.get("value", "").strip()]
    out.sort(key=lambda x: str(x.get("label") or x.get("value")))
    return out


def _factor_param_specs(factor_id: str) -> dict[str, dict[str, Any]]:
    fid = str(factor_id).strip()
    if not fid:
        return {}
    try:
        factor_cls = get_factor(fid)
    except Exception:
        factor_cls = None
    if factor_cls is None:
        return {}
    if not callable(getattr(factor_cls, "get_param_specs", None)):
        return {}
    try:
        # Normalize to a name->spec map.
        if callable(getattr(factor_cls, "get_param_spec_map", None)):
            return factor_cls.get_param_spec_map() or {}
        specs = factor_cls.get_param_specs() or ()
        return {str(s.get("name")): s for s in specs if isinstance(s, dict) and s.get("name")}
    except Exception:
        return {}


def _factor_params_rjsf_properties(param_specs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    props: dict[str, Any] = {}
    for key, spec in (param_specs or {}).items():
        if not isinstance(key, str) or not key.strip() or not isinstance(spec, dict):
            continue
        item_schema: dict[str, Any] = {"type": "number", "title": spec.get("label") or key}
        desc = str(spec.get("description") or "").strip()
        if desc:
            item_schema["description"] = desc
        if "default" in spec and spec["default"] is not None:
            item_schema["default"] = spec["default"]
        if "min" in spec and spec["min"] is not None:
            item_schema["minimum"] = spec["min"]
        if "max" in spec and spec["max"] is not None:
            item_schema["maximum"] = spec["max"]
        props[key] = item_schema
    return props


def _factor_params_object_schema(param_specs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    props = _factor_params_rjsf_properties(param_specs)
    schema: dict[str, Any] = {
        "type": "object",
        "title": "因子参数",
        "properties": props,
        "additionalProperties": False,
    }
    defaults: dict[str, Any] = {}
    for k, s in props.items():
        if isinstance(s, dict) and "default" in s:
            defaults[k] = s.get("default")
    schema["default"] = defaults
    return schema


def _factor_ref_one_of(options: list[dict[str, str]]) -> list[dict[str, Any]]:
    one_of: list[dict[str, Any]] = []
    for opt in options:
        fid = str(opt.get("value") or "").strip()
        if not fid:
            continue
        title = str(opt.get("label") or fid)
        param_specs = _factor_param_specs(fid)
        one_of.append(
            {
                "title": title,
                "type": "object",
                "properties": {
                    "factor_id": {"const": fid, "title": "因子"},
                    "factor_params": _factor_params_object_schema(param_specs),
                },
                "required": ["factor_id"],
            }
        )
    return one_of


def _factor_ref_rjsf_schema() -> dict[str, Any]:
    options = _factor_ref_options()
    factor_ids = [str(o["value"]) for o in options]
    one_of = _factor_ref_one_of(options)
    first_factor_id = factor_ids[0] if factor_ids else ""
    first_param_defaults: dict[str, Any] = {}
    if first_factor_id:
        first_specs = _factor_param_specs(first_factor_id)
        first_schema = _factor_params_object_schema(first_specs)
        if isinstance(first_schema, dict):
            first_param_defaults = dict(first_schema.get("default") or {})
    return {
        "type": "object",
        "default": {"factor_id": first_factor_id, "factor_params": first_param_defaults},
        "properties": {
            "factor_id": {
                "type": "string",
                "title": "因子",
                # Prefer `oneOf(const+title)` for labels in RJSF.
                "oneOf": [
                    {
                        "const": str(o.get("value") or "").strip(),
                        "title": str(o.get("label") or o.get("value")),
                    }
                    for o in options
                    if str(o.get("value") or "").strip()
                ],
                "default": first_factor_id,
            },
            # Keep a root-level placeholder so RJSF reliably renders this field,
            # while `dependencies.factor_id.oneOf` provides the concrete schema per factor.
            "factor_params": _factor_params_object_schema({}),
        },
        "dependencies": {"factor_id": {"oneOf": one_of} if one_of else {}},
    }


def _factor_ref_rjsf_ui_schema() -> dict[str, Any]:
    return {
        "ui:submitButtonOptions": {"norender": True},
        "ui:title": "",
        "factor_id": {
            "ui:options": {"label": False},
        },
        "factor_params": {
            "ui:options": {"label": False},
        },
    }


@workflow_node(
    input_sockets=[
        Socket("data_set", required=True, value_type="data_set", label="数据集"),
        RJSFNodeParam(
            name="factor",
            label="因子",
            description="选择因子并配置参数",
            json_schema=_factor_ref_rjsf_schema,
            ui_schema=_factor_ref_rjsf_ui_schema,
        ),
    ],
    output_sockets=[Socket("factor", required=True, value_type="dataframe", label="因子矩阵")],
    label="因子计算",
    description=(
        "加载并计算因子，输出宽表因子矩阵（index=date, columns=asset）。\n"
        "\n"
        "示例输出：\n"
        "\n"
        "| date       | AAPL | MSFT |\n"
        "|------------|------|------|\n"
        "| 2026-04-01 | 1.23 | 0.87 |\n"
        "| 2026-04-02 | 1.18 | 0.91 |\n"
    ),
    category="common",
)
class FactorRefNode:
    def _merge_factor_params(
        self,
        *,
        out: dict[str, float | int],
        spec_map: dict[str, dict[str, Any]],
        raw: dict[str, Any],
    ) -> None:
        for key, value in raw.items():
            if not isinstance(key, str) or not key.strip() or key not in spec_map:
                continue
            if value is None or value == "":
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{key} 必须是数值")
            out[key] = value

    def _extract_factor_params(
        self, factor_cls: Any, kwargs: dict[str, Any]
    ) -> dict[str, float | int]:
        if callable(getattr(factor_cls, "get_param_spec_map", None)):
            spec_map = factor_cls.get_param_spec_map()
        else:
            spec_map = {
                s.get("name"): s for s in factor_cls.get_param_specs() if isinstance(s, dict)
            }
        out: dict[str, float | int] = {}

        factor_params_raw = kwargs.get("factor_params")
        if factor_params_raw is not None:
            if not isinstance(factor_params_raw, dict):
                raise ValueError("factor_params 必须是对象")
            self._merge_factor_params(out=out, spec_map=spec_map, raw=factor_params_raw)

        by_kwargs = {k: kwargs.get(k) for k in spec_map if k in kwargs}
        self._merge_factor_params(out=out, spec_map=spec_map, raw=by_kwargs)

        return out

    def execute(self, **kwargs: Any) -> pd.DataFrame:
        ds: Any = kwargs["data_set"]
        merged_kwargs = dict(kwargs)
        factor_conf = merged_kwargs.get("factor")
        if isinstance(factor_conf, dict):
            fid = str(factor_conf.get("factor_id") or "").strip()
            if fid:
                merged_kwargs["factor_id"] = fid
            fp = factor_conf.get("factor_params")
            if isinstance(fp, dict):
                merged_kwargs["factor_params"] = fp
                # Also allow flat overrides (compatible with existing extraction logic).
                for k, v in fp.items():
                    if k not in merged_kwargs:
                        merged_kwargs[k] = v

        factor_id = str(merged_kwargs.get("factor_id") or "").strip()
        if not factor_id:
            raise ValueError("factor_id 不能为空")
        factor_cls = get_factor(factor_id)
        if factor_cls is None:
            raise ValueError("因子不存在或无法加载")
        factor_params = self._extract_factor_params(factor_cls, merged_kwargs)

        if not ds.end_date:
            raise ValueError("数据集缺少 end_date")
        resolver = ds.create_resolver()
        factor = factor_cls(dependency_resolver=resolver, params=factor_params)
        df = factor.calculate(
            start_date=ds.start_date, end_date=ds.end_date, instrument_codes=ds.instrument_codes
        )

        return df.sort_index().sort_index(axis=1)
