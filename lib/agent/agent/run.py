"""
CLI: 因子挖掘 Agent

使用本地 Ollama（默认模型可通过环境变量配置）。

  uv run python -m agent.run "基于换手率与动量构造反转因子"

环境变量（与 trade-backend addons.agent 对齐）:
  FACTOR_AGENT_LLM_PROVIDER   ollama（默认）| openai
  FACTOR_AGENT_MODEL / OLLAMA_MODEL
  OLLAMA_BASE_URL
  OPENAI_API_KEY / OPENAI_BASE_URL（provider=openai 时）
  另：工作区 ``config/agent_llm.json`` 可由 Web Agent 页面写入，env 优先覆盖。
  FACTOR_AGENT_TEMPERATURE
  FACTOR_AGENT_START_DATE / FACTOR_AGENT_END_DATE
  FACTOR_AGENT_EVAL_START / FACTOR_AGENT_EVAL_END
  FACTOR_AGENT_STOCK_CODES
  FACTOR_AGENT_QUANTILES
  FACTOR_AGENT_SKIP_EVAL=1
  FACTOR_AGENT_LOG_LEVEL / FACTOR_AGENT_LOG_MAX_BYTES / FACTOR_AGENT_LOG_BACKUP_COUNT
  FACTOR_AGENT_LLM_LOG_MAX_CHARS
  FACTOR_AGENT_STREAM_OUTPUT / FACTOR_AGENT_STREAM_API / FACTOR_AGENT_STREAM_MAX_CHUNKS
  FACTOR_AGENT_OLLAMA_TIMEOUT
  FACTOR_AGENT_NUM_PREDICT
  FACTOR_AGENT_OLLAMA_REASONING

运行干跑与 Alphalens 前须配置 :func:`agent.context.set_dependency_resolver`
或向 :func:`run_factor_digging` 传入 ``dependency_resolver``。

仓库内带 SQL 数据源的端到端示例：``examples/agent-sql-dig/run.py``。
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from factor.dependency_resolver import DependencyResolver


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass


def run_factor_digging(
    user_prompt: str = "",
    *,
    dependency_resolver: DependencyResolver | None = None,
) -> dict[str, Any]:
    """
    LangGraph：上下文 -> 立意 -> 伪代码 -> 代码 -> 干跑 ->（可选）Alphalens -> 报告。
    """
    _load_env()
    from agent.context import set_dependency_resolver
    from agent.graph import build_factor_digging_graph
    from agent.logging_setup import configure_agent_logging

    configure_agent_logging()
    if dependency_resolver is not None:
        set_dependency_resolver(dependency_resolver)

    app = build_factor_digging_graph()
    return app.invoke({"user_prompt": user_prompt.strip()})


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
