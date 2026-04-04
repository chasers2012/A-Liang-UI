"""
用 SQL 行情表注册 DependencyResolver，再跑因子挖掘 Agent（Ollama + LangGraph）。

与 ``examples/sql-momentum-factor`` 相同的数据库参数；额外需要本机 Ollama 与模型。

仓库根目录（需已 ``uv sync --group dev``）::

  uv run python examples/agent-sql-dig/run.py --db path/to/bars.db \\
    --end-date 2025-02-10 --prompt "基于 close 构造简单动量类因子思路"

默认跳过 Alphalens，仅干跑校验生成的代码；要跑完整评价请加 ``--eval``。

LLM 与工作区 ``config/agent_llm.json`` 一致；干跑/评价日期等通过
``run_factor_digging(..., execution={...})`` 传入（见 ``main``）。
"""

from __future__ import annotations

import argparse
from pathlib import Path

from agent.run import run_factor_digging
from factor import DependencyResolver
from sql_datasource import SqlDataSource
from sqlalchemy import create_engine


def _engine_url(args: argparse.Namespace) -> str:
    if args.database_url:
        return args.database_url
    return f"sqlite:///{args.db.resolve()}"


def main() -> int:
    p = argparse.ArgumentParser(
        description="SqlDataSource + DependencyResolver + 因子挖掘 Agent",
    )
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument(
        "--db",
        type=Path,
        help="SQLite 文件路径（与 --database-url 二选一）",
    )
    src.add_argument(
        "--database-url",
        metavar="URL",
        help="SQLAlchemy 连接串（与 --db 二选一）",
    )
    p.add_argument("--table", default="bars", help="行情表名（默认 bars）")
    p.add_argument("--date-column", default="date", help="日期列（默认 date）")
    p.add_argument("--asset-column", default="code", help="资产代码列（默认 code）")
    p.add_argument(
        "--close-column",
        default="close",
        help="收盘价列；映射为因子依赖 close（默认 close）",
    )
    p.add_argument(
        "--end-date",
        required=True,
        help="面板结束日 YYYY-MM-DD（与 SqlDataSource / Factor 一致）",
    )
    p.add_argument(
        "prompt",
        nargs="*",
        default=[],
        help="交给 Agent 的主题（中文/英文均可）；可省略则用默认句",
    )
    p.add_argument(
        "--eval",
        action="store_true",
        help="不跳过 Alphalens（默认跳过以加快演示）",
    )
    args = p.parse_args()

    engine = create_engine(_engine_url(args))
    column_map = {"close": args.close_column} if args.close_column != "close" else None
    ds = SqlDataSource(
        engine,
        table=args.table,
        date_column=args.date_column,
        asset_column=args.asset_column,
        column_map=column_map,
    )
    resolver = DependencyResolver()
    resolver.register_datasource(ds, ["close"])

    user_prompt = " ".join(args.prompt).strip()
    if not user_prompt:
        user_prompt = "请基于已有 close 字段提一个可实现的截面或时序因子，并生成代码。"

    result = run_factor_digging(
        user_prompt,
        dependency_resolver=resolver,
        execution={
            "skip_alphalens_evaluation": not args.eval,
            "dry_run_end_date": args.end_date,
            "eval_end_date": args.end_date,
        },
    )
    report = result.get("final_report")
    if report:
        print(report)
    else:
        print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
