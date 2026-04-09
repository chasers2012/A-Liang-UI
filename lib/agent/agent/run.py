"""
CLI: 因子挖掘 Agent

使用本地 Ollama（默认）；模型与 OpenAI 等由工作区 ``config/agent_llm.json`` 配置
（Web Agent 页面可写入）。

  uv run python -m agent.run "基于换手率与动量构造反转因子"

干跑与 Alphalens 的日期、标的列表、分位数、是否跳过评价等通过
:func:`run_factor_digging` 的 ``execution`` 参数（或等价字段）写入 graph state；
未传入时在 ``init_context`` 节点填入 :data:`agent.state.DEFAULT_FACTOR_DIGGING_EXECUTION`。

运行干跑与 Alphalens 前须配置 :func:`agent.context.set_dependency_resolver`
或向 :func:`run_factor_digging` 传入 ``dependency_resolver``。

仓库内带 SQL 数据源的端到端示例：``examples/agent-sql-dig/run.py``。
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from factor.dependency_resolver import DependencyResolver


def run_factor_digging(
    user_prompt: str = "",
    *,
    dependency_resolver: DependencyResolver | None = None,
    execution: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    LangGraph：上下文 -> 立意 -> 伪代码 -> 代码 -> 干跑 ->（可选）Alphalens -> 报告。

    ``execution`` 可选，合并进初始 state，键与 :class:`agent.state.FactorDiggingState`
    中干跑/评价相关字段一致，例如 ``dry_run_end_date``、``eval_end_date``、
    ``instrument_codes``、``quantiles``、``skip_alphalens_evaluation``。
    """
    from agent.context import set_dependency_resolver
    from agent.graph import build_factor_digging_graph

    if dependency_resolver is not None:
        set_dependency_resolver(dependency_resolver)

    initial: dict[str, Any] = {"user_prompt": user_prompt.strip()}
    if execution:
        initial.update(execution)

    app = build_factor_digging_graph()
    return app.invoke(initial)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Factor digging agent (LangGraph)")
    parser.add_argument(
        "prompt",
        nargs="*",
        default=[],
        help="用户主题/想法（可空格分隔多词）",
    )
    args = parser.parse_args(argv)
    user_prompt = " ".join(args.prompt).strip()

    result = run_factor_digging(user_prompt)
    print(result.get("final_report", result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
