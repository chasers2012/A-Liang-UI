"""
从 SQL 表加载收盘价，经 SqlDataSource + DependencyResolver 计算 10 日动量并写出 CSV。

支持 SQLite 文件与 PostgreSQL 等（通过 SQLAlchemy URL）。表需已存在且含配置的日期、资产、收盘价列。

用法（仓库根目录，dev 依赖含 factor、sql-datasource；PostgreSQL 另需 psycopg）:
  uv run python examples/sql-momentum-factor/run.py --db path/to/bars.db \\
    --end-date 2025-02-10 -o mom.csv
  uv run python examples/sql-momentum-factor/run.py \\
    --database-url postgresql+psycopg://user:pass@localhost:5432/dbname \\
    --end-date 2025-02-10 -o mom.csv
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine

_EX_DIR = Path(__file__).resolve().parent
if str(_EX_DIR) not in sys.path:
    sys.path.insert(0, str(_EX_DIR))

from factor import DependencyResolver  # noqa: E402
from momentum_factor import MomentumFactor  # noqa: E402
from sql_datasource import SqlDataSource  # noqa: E402


def _engine_url(args: argparse.Namespace) -> str:
    if args.database_url:
        return args.database_url
    return f"sqlite:///{args.db.resolve()}"


def main() -> None:
    p = argparse.ArgumentParser(
        description=
        "用 SqlDataSource（SQLite / PostgreSQL 等）计算 MomentumFactor 并保存 CSV")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument(
        "--db",
        type=Path,
        help="SQLite 文件路径（与 --database-url 二选一）",
    )
    src.add_argument(
        "--database-url",
        metavar="URL",
        help=(
            "SQLAlchemy 连接串，例如 postgresql+psycopg://user:pass@host:5432/dbname "
            "或 sqlite:///path/file.db（与 --db 二选一）"),
    )
    p.add_argument(
        "--table",
        default="bars",
        help="行情表名（默认: bars）",
    )
    p.add_argument(
        "--date-column",
        default="date",
        help="表中日期列名，YYYY-MM-DD 文本（默认: date）",
    )
    p.add_argument(
        "--asset-column",
        default="code",
        help="表中资产代码列名（默认: code",
    )
    p.add_argument(
        "--close-column",
        default="close",
        help="表中收盘价列名，映射为因子依赖 close（默认: close）",
    )
    p.add_argument(
        "--start-date",
        default=None,
        help="起始日期 YYYY-MM-DD；省略则只保留 end_date 前最后一截面（Factor.calculate）",
    )
    p.add_argument(
        "--end-date",
        required=True,
        help="结束日期 YYYY-MM-DD（含）",
    )
    p.add_argument(
        "-o",
        "--output",
        required=True,
        type=Path,
        help="输出因子 CSV 路径",
    )
    args = p.parse_args()

    engine = create_engine(_engine_url(args))

    column_map = ({
        "close": args.close_column
    } if args.close_column != "close" else None)
    ds = SqlDataSource(
        engine,
        table=args.table,
        date_column=args.date_column,
        asset_column=args.asset_column,
        column_map=column_map,
    )
    resolver = DependencyResolver()
    resolver.register_datasource(ds, ["close"])

    factor = MomentumFactor(dependency_resolver=resolver)
    out = factor.calculate(args.start_date, args.end_date)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.reset_index().to_csv(args.output, index=False)


if __name__ == "__main__":
    main()
