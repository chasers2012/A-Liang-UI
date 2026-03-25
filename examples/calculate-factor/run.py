"""
从 CSV 加载行情，用 evaluate + datasource_csv 计算 PriceFactor，并写出结果。

用法（在 quant-agent 仓库根目录）:
  uv run python examples/calculate-factor/run.py -i data.csv -o factors.csv --end-date 2025-01-03
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from datasource_csv import CsvFactorDataSource
from evaluate import compute_factor_values_from_source

_EX_DIR = Path(__file__).resolve().parent
if str(_EX_DIR) not in sys.path:
    sys.path.insert(0, str(_EX_DIR))

from price_factor import PriceFactor  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description="计算 PriceFactor 并保存为 CSV")
    p.add_argument(
        "-i",
        "--input",
        required=True,
        type=Path,
        help="输入 CSV（长表：日期、资产、收盘价等）",
    )
    p.add_argument(
        "-o",
        "--output",
        required=True,
        type=Path,
        help="输出 CSV 路径",
    )
    p.add_argument(
        "--date-column",
        default="date",
        help="CSV 中日期列名（默认: date）",
    )
    p.add_argument(
        "--asset-column",
        default="asset",
        help="CSV 中资产代码列名（默认: asset）",
    )
    p.add_argument(
        "--close-column",
        default="close",
        help="CSV 中收盘价列名，将映射为因子依赖 close（默认: close）",
    )
    p.add_argument(
        "--start-date",
        default=None,
        help="起始日期 YYYY-MM-DD，省略则不限起点（仍受 CSV 与 window 影响）",
    )
    p.add_argument(
        "--end-date",
        required=True,
        help="结束日期 YYYY-MM-DD（含）",
    )
    args = p.parse_args()

    column_map = {}
    if args.close_column != "close":
        column_map["close"] = args.close_column

    ds = CsvFactorDataSource(
        args.input,
        date_column=args.date_column,
        asset_column=args.asset_column,
        column_map=column_map or None,
    )
    factors = [PriceFactor()]
    out = compute_factor_values_from_source(
        factors,
        ds,
        start_date=args.start_date,
        end_date=args.end_date,
        stock_codes=None,
    )
    flat = out.reset_index()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    flat.to_csv(args.output, index=False)


if __name__ == "__main__":
    main()
