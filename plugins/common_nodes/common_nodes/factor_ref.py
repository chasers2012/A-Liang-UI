from __future__ import annotations

from typing import Any

import pandas as pd
from app.factors.controller import get_factor
from app.factors.registry import FactorItemsRegistry
from factor import Factor
from workflow import Socket, workflow_node
from workflow.node_types import RJSFNodeParam


def _factor_param_specs(factor_cls: type[Factor]) -> dict[str, dict[str, Any]]:
    specs = factor_cls.get_param_specs() or ()
    return {str(s["name"]): s for s in specs}


def _factor_ref_factors() -> list[type[(str, Factor)]]:
    return [(f.id, get_factor(str(f.id))) for f in FactorItemsRegistry.list_items()]


def _factor_params_rjsf_properties(param_specs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    field_map = {"default": "default", "min": "minimum", "max": "maximum"}
    props: dict[str, Any] = {}
    for key, spec in param_specs.items():
        item_schema: dict[str, Any] = {"type": "number", "title": spec.get("label") or key}
        desc = str(spec.get("description") or "").strip()
        if desc:
            item_schema["description"] = desc
        for source_key, target_key in field_map.items():
            value = spec.get(source_key)
            if value is not None:
                item_schema[target_key] = value
        props[key] = item_schema
    return props


def _factor_params_object_schema(param_specs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    props = _factor_params_rjsf_properties(param_specs)
    return {
        "type": "object",
        "title": "因子参数",
        "properties": props,
        "additionalProperties": False,
        "default": {
            k: s.get("default") for k, s in props.items() if isinstance(s, dict) and "default" in s
        },
    }


def _factor_ref_one_of(factors: list[type[str, Factor]]) -> list[dict[str, Any]]:
    return [
        {
            "title": factor.name or str(id),
            "type": "object",
            "properties": {
                "factor_id": {"const": str(id), "title": "因子"},
                "factor_params": _factor_params_object_schema(_factor_param_specs(factor)),
            },
            "required": ["factor_id"],
        }
        for id, factor in factors
    ]


def _factor_ref_rjsf_schema() -> dict[str, Any]:
    factors = _factor_ref_factors()
    one_of = _factor_ref_one_of(factors)
    factor_one_of = [{"const": str(id), "title": factor.name or str(id)} for id, factor in factors]
    return {
        "type": "object",
        "properties": {
            "factor_id": {
                "type": "string",
                "title": "因子",
                # Prefer `oneOf(const+title)` for labels in RJSF.
                "oneOf": factor_one_of,
            },
        },
        "dependencies": {"factor_id": {"oneOf": one_of}},
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
        spec_map = {s.get("name"): s for s in factor_cls.get_param_specs() if isinstance(s, dict)}
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
