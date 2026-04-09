"""LangChain tools: LLM ideation/codegen, dependency fields, dry-run, Alphalens."""

from __future__ import annotations

import json
import traceback
from typing import Any

import pandas as pd
from factor import is_valid_factor_class
from langchain_core.tools import tool

from agent.context import get_dependency_resolver, list_registered_dependency_fields
from agent.state import (
    DEFAULT_DRY_RUN_END_DATE,
    DEFAULT_DRY_RUN_START_DATE,
    DEFAULT_EVAL_END_DATE,
    DEFAULT_EVAL_START_DATE,
    DEFAULT_QUANTILES,
)

__all__ = [
    "FACTOR_EXECUTION_TOOLS",
    "describe_factor_dependency_fields",
    "dry_run_factor_source",
    "evaluate_factor_with_alphalens",
    "format_fields_csv",
    "list_factor_dependency_fields",
    "run_alphalens_evaluation",
    "run_factor_dry_run",
]


def list_factor_dependency_fields() -> list[str]:
    """Registered dependency field names (for graph state)."""
    return list_registered_dependency_fields()


def format_fields_csv(fields: list[str], *, max_show: int = 80) -> str:
    return ", ".join(fields[:max_show]) + ("…" if len(fields) > max_show else "")


@tool
def describe_factor_dependency_fields() -> str:
    """Comma-separated dependency field names for Factor implementations (truncated)."""
    return format_fields_csv(list_factor_dependency_fields())


def run_factor_dry_run(
    factor_source: str,
    *,
    dry_run_start_date: str = DEFAULT_DRY_RUN_START_DATE,
    dry_run_end_date: str = DEFAULT_DRY_RUN_END_DATE,
    instrument_codes: list[str] | None = None,
) -> dict[str, Any]:
    """Load factor source and run ``calculate()``; dict for graph state updates."""
    if not factor_source:
        return {"dry_run_ok": False, "dry_run_error": "未生成因子代码"}

    resolver = get_dependency_resolver()
    if resolver is None:
        return {
            "dry_run_ok": False,
            "dry_run_error": (
                "未配置 DependencyResolver：请在运行前调用 "
                "agent.context.set_dependency_resolver(resolver)，"
                "或在 run_factor_digging(..., dependency_resolver=...) 传入。"
            ),
        }

    start = dry_run_start_date
    end = dry_run_end_date

    try:
        cls, class_name = is_valid_factor_class(factor_source)
        inst = cls(dependency_resolver=resolver)
        out = inst.calculate(start_date=start, end_date=end, instrument_codes=instrument_codes)
        if out.empty:
            return {
                "dry_run_ok": False,
                "dry_run_error": "calculate 结果为空，请检查窗口、依赖字段与 calc 逻辑",
                "factor_class_name": class_name,
            }
        if not isinstance(out.index, pd.MultiIndex):
            return {
                "dry_run_ok": False,
                "dry_run_error": "calc 输出索引必须是 MultiIndex",
                "factor_class_name": class_name,
            }
        return {"dry_run_ok": True, "dry_run_error": None, "factor_class_name": class_name}
    except Exception as e:
        return {"dry_run_ok": False, "dry_run_error": f"{e}\n{traceback.format_exc()}"}


@tool
def dry_run_factor_source(factor_source: str) -> str:
    """Dry-run factor source: JSON with dry_run_ok, dry_run_error, factor_class_name."""
    return json.dumps(run_factor_dry_run(factor_source), ensure_ascii=False)


def run_alphalens_evaluation(
    factor_source: str,
    *,
    skip_alphalens_evaluation: bool = False,
    eval_start_date: str = DEFAULT_EVAL_START_DATE,
    eval_end_date: str = DEFAULT_EVAL_END_DATE,
    instrument_codes: list[str] | None = None,
    quantiles: int = DEFAULT_QUANTILES,
) -> dict[str, Any]:
    """Run Alphalens evaluation for the given factor source."""
    if skip_alphalens_evaluation:
        return {
            "evaluation_summary": "已跳过 Alphalens 评价（skip_alphalens_evaluation=True）。",
            "evaluation_error": None,
        }

    resolver = get_dependency_resolver()
    if resolver is None:
        return {
            "evaluation_summary": "",
            "evaluation_error": "跳过评价：未配置 DependencyResolver",
        }

    start = eval_start_date
    end = eval_end_date

    try:
        import matplotlib

        matplotlib.use("Agg")

        from evaluate import AlphalensFactorEvaluator

        cls, _ = is_valid_factor_class(factor_source)
        factor = cls(dependency_resolver=resolver)
        ev = AlphalensFactorEvaluator(
            factor,
            start_date=start,
            end_date=end,
            instrument_codes=instrument_codes,
            long_short=True,
        )
        ev.evaluate_factor(quantiles=quantiles, periods=(1, 5, 10, 20))
        name = factor.name
        summary = (
            f"因子 {name} 已完成 Alphalens 评价（{start}～{end}，quantiles={quantiles}）。"
            " 指标由 evaluate.AlphalensFactorEvaluator 在内存中计算（未写 tear sheet 文件）。"
        )
        return {"evaluation_summary": summary, "evaluation_error": None}
    except Exception as e:
        return {"evaluation_summary": "", "evaluation_error": f"{e}\n{traceback.format_exc()}"}


@tool
def evaluate_factor_with_alphalens(factor_source: str) -> str:
    """Alphalens evaluation: JSON with evaluation_summary and evaluation_error."""
    return json.dumps(run_alphalens_evaluation(factor_source), ensure_ascii=False)


FACTOR_EXECUTION_TOOLS = [
    describe_factor_dependency_fields,
    dry_run_factor_source,
    evaluate_factor_with_alphalens,
]
