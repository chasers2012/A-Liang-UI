"""LangGraph node callables."""

from __future__ import annotations

import os
import traceback
from typing import Any

import pandas as pd
from langchain_core.messages import HumanMessage, SystemMessage

from agent.codegen import load_factor_class
from agent.context import get_dependency_resolver, list_registered_dependency_fields
from agent.llm import build_chat_llm, message_text, stream_logged
from agent.logging_setup import get_agent_logger
from agent.prompts import (
    DEFAULT_IDEATE_USER_TOPIC,
    SYSTEM_CODEGEN,
    SYSTEM_IDEATE,
    SYSTEM_PSEUDOCODE,
    codegen_human_message,
    ideate_human_message,
    pseudocode_human_message,
)
from agent.state import FactorDiggingState


def _log():
    return get_agent_logger(__name__)


def node_init_context(state: FactorDiggingState) -> dict[str, Any]:
    _log().info("node init_context")
    return {
        "available_fields": list_registered_dependency_fields(),
        "repair_count": 0,
        "dry_run_ok": False,
    }


def node_ideate(state: FactorDiggingState) -> dict[str, Any]:
    _log().info("node ideate")
    fields = state.get("available_fields") or list_registered_dependency_fields()
    fields_txt = ", ".join(fields[:80]) + ("…" if len(fields) > 80 else "")
    user = state.get("user_prompt", "").strip() or DEFAULT_IDEATE_USER_TOPIC
    llm = build_chat_llm()
    msg = stream_logged(
        llm,
        [
            SystemMessage(content=SYSTEM_IDEATE),
            HumanMessage(content=ideate_human_message(fields_txt, user)),
        ],
        stage="ideate",
    )
    idea = message_text(msg).strip()
    _log().info("ideate done, length=%s", len(idea))
    return {"research_idea": idea}


def node_generate_pseudocode(state: FactorDiggingState) -> dict[str, Any]:
    _log().info("node generate_pseudocode")
    fields = state.get("available_fields") or list_registered_dependency_fields()
    fields_txt = ", ".join(fields[:80]) + ("…" if len(fields) > 80 else "")
    idea = (state.get("research_idea") or "").strip()
    llm = build_chat_llm()
    msg = stream_logged(
        llm,
        [
            SystemMessage(content=SYSTEM_PSEUDOCODE),
            HumanMessage(content=pseudocode_human_message(fields_txt, idea)),
        ],
        stage="pseudocode",
    )
    pseudo = message_text(msg).strip()
    _log().info("pseudocode done, length=%s", len(pseudo))
    return {"pseudocode": pseudo}


def node_generate_code(state: FactorDiggingState) -> dict[str, Any]:
    fields = state.get("available_fields") or list_registered_dependency_fields()
    fields_txt = ", ".join(fields)
    idea = state.get("research_idea", "")
    pseudo = (state.get("pseudocode") or "").strip()
    prev_err = state.get("dry_run_error")
    prev_repair = state.get("repair_count", 0)
    repair = prev_repair + 1 if prev_err else prev_repair

    human = codegen_human_message(fields_txt, idea, pseudo, prev_err, repair)

    _log().info("node generate_code (repair_count=%s)", repair)
    llm = build_chat_llm()
    msg = stream_logged(
        llm,
        [SystemMessage(content=SYSTEM_CODEGEN), HumanMessage(content=human)],
        stage="codegen",
    )
    src = message_text(msg).strip()
    _log().info("codegen done, source length=%s", len(src))
    return {"factor_source": src, "dry_run_error": None, "repair_count": repair}


def node_validate_dry_run(state: FactorDiggingState) -> dict[str, Any]:
    _log().info("node validate_dry_run")
    src = state.get("factor_source") or ""
    if not src:
        _log().warning("dry run: empty factor_source")
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

    start = os.environ.get("FACTOR_AGENT_START_DATE", "2024-06-01")
    end = os.environ.get("FACTOR_AGENT_END_DATE", "2024-12-31")
    codes_env = os.environ.get("FACTOR_AGENT_STOCK_CODES", "")
    stock_codes: list[str] | None = (
        [c.strip() for c in codes_env.split(",") if c.strip()] if codes_env else None
    )

    try:
        cls, class_name = load_factor_class(src)
        inst = cls(dependency_resolver=resolver)
        out = inst.calculate(start_date=start, end_date=end, stock_codes=stock_codes)
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
        _log().info("dry run ok, class=%s, rows=%s", class_name, len(out))
        return {"dry_run_ok": True, "dry_run_error": None, "factor_class_name": class_name}
    except Exception as e:
        tb = traceback.format_exc()
        _log().warning("dry run failed: %s", e)
        return {"dry_run_ok": False, "dry_run_error": f"{e}\n{tb}"}


def node_evaluate_alphalens(state: FactorDiggingState) -> dict[str, Any]:
    if not state.get("dry_run_ok"):
        _log().info("evaluate_alphalens skipped (dry_run not ok)")
        return {"evaluation_summary": "", "evaluation_error": "跳过评价：校验未通过"}

    if os.environ.get("FACTOR_AGENT_SKIP_EVAL", "").strip().lower() in {"1", "true", "yes"}:
        _log().info("evaluate_alphalens skipped (FACTOR_AGENT_SKIP_EVAL)")
        return {
            "evaluation_summary": "已根据 FACTOR_AGENT_SKIP_EVAL 跳过 Alphalens 评价。",
            "evaluation_error": None,
        }

    resolver = get_dependency_resolver()
    if resolver is None:
        return {
            "evaluation_summary": "",
            "evaluation_error": "跳过评价：未配置 DependencyResolver",
        }

    src = state.get("factor_source") or ""
    start = os.environ.get(
        "FACTOR_AGENT_EVAL_START",
        os.environ.get("FACTOR_AGENT_START_DATE", "2023-01-01"),
    )
    end = os.environ.get(
        "FACTOR_AGENT_EVAL_END",
        os.environ.get("FACTOR_AGENT_END_DATE", "2024-12-31"),
    )
    codes_env = os.environ.get("FACTOR_AGENT_STOCK_CODES", "")
    stock_codes: list[str] | None = (
        [c.strip() for c in codes_env.split(",") if c.strip()] if codes_env else None
    )
    quantiles = int(os.environ.get("FACTOR_AGENT_QUANTILES", "5"))

    _log().info("node evaluate_alphalens %s～%s quantiles=%s", start, end, quantiles)
    try:
        import matplotlib

        matplotlib.use("Agg")

        from evaluate import AlphalensFactorEvaluator

        cls, _ = load_factor_class(src)
        factor = cls(dependency_resolver=resolver)
        ev = AlphalensFactorEvaluator(
            factor,
            start_date=start,
            end_date=end,
            stock_codes=stock_codes,
            long_short=True,
        )
        ev.evaluate_factor(quantiles=quantiles, periods=(1, 5, 10, 20))
        name = factor.name
        summary = (
            f"因子 {name} 已完成 Alphalens 评价（{start}～{end}，quantiles={quantiles}）。"
            " 指标由 evaluate.AlphalensFactorEvaluator 在内存中计算（未写 tear sheet 文件）。"
        )
        _log().info("alphalens ok, factor=%s", name)
        return {"evaluation_summary": summary, "evaluation_error": None}
    except Exception as e:
        _log().warning("alphalens failed: %s", e)
        return {"evaluation_summary": "", "evaluation_error": f"{e}\n{traceback.format_exc()}"}


def node_finalize(state: FactorDiggingState) -> dict[str, Any]:
    _log().info("node finalize")
    parts = [
        "## 因子挖掘结果\n",
        f"**思路**: {state.get('research_idea', '')}\n",
    ]
    if state.get("pseudocode"):
        parts.append(f"**伪代码**:\n```\n{state['pseudocode']}\n```\n")
    if state.get("dry_run_ok"):
        parts.append(f"**校验**: 通过（类名 {state.get('factor_class_name', '')}）\n")
    else:
        parts.append(f"**校验**: 失败\n{state.get('dry_run_error', '')}\n")
    if state.get("evaluation_summary"):
        parts.append(f"**评价**: {state['evaluation_summary']}\n")
    if state.get("evaluation_error"):
        parts.append(f"**评价错误**: {state['evaluation_error']}\n")
    if state.get("factor_source"):
        parts.append("\n### 生成的代码\n```python\n" + state["factor_source"] + "\n```\n")
    report = "\n".join(parts)
    return {"final_report": report}
