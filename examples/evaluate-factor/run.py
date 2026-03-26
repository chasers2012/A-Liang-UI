"""
从 CSV 加载行情，计算因子并用 Alphalens（evaluate.AlphalensFactorEvaluator）做效果评估。

用法（在 quant-agent 仓库根目录，需 dev 依赖含 evaluate、csv-datasource）:
  uv run python examples/evaluate-factor/run.py
  uv run python examples/evaluate-factor/run.py -i path/to/bars.csv
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

_EX_DIR = Path(__file__).resolve().parent
if str(_EX_DIR) not in sys.path:
    sys.path.insert(0, str(_EX_DIR))

from momentum_factor import MomentumFactor  # noqa: E402
from csv_datasource import CsvDataSource  # noqa: E402
from evaluate import AlphalensFactorEvaluator  # noqa: E402
from factor import DependencyResolver  # noqa: E402


def _default_end_date(csv_path: Path, date_column: str) -> str:
    df = pd.read_csv(csv_path, usecols=[date_column])
    return pd.to_datetime(df[date_column]).max().strftime("%Y-%m-%d")


def _default_start_date(csv_path: Path, date_column: str) -> str:
    """整段样本评估需要完整行情；省略 --start-date 时用 CSV 最早日期。"""
    df = pd.read_csv(csv_path, usecols=[date_column])
    return pd.to_datetime(df[date_column]).min().strftime("%Y-%m-%d")


def main() -> None:
    default_csv = _EX_DIR / "sample_bars.csv"
    p = argparse.ArgumentParser(description="评估因子（Alphalens IC / 分位收益等）")
    p.add_argument(
        "-i",
        "--input",
        type=Path,
        default=default_csv,
        help=f"行情 CSV（长表，默认: {default_csv.name}）",
    )
    p.add_argument("--date-column", default="date", help="日期列名（默认: date）")
    p.add_argument("--asset-column", default="asset", help="资产列名（默认: asset）")
    p.add_argument("--close-column", default="close", help="收盘价列名（默认: close）")
    p.add_argument(
        "--start-date",
        default=None,
        help="起始日期 YYYY-MM-DD；省略则使用 CSV 中最早日期（保证 Alphalens 有足够样本）",
    )
    p.add_argument(
        "--end-date",
        default=None,
        help="结束日期 YYYY-MM-DD（含）；省略则取 CSV 中最大日期",
    )
    p.add_argument(
        "--quantiles",
        type=int,
        default=5,
        help="分位数数量（默认: 5）",
    )
    p.add_argument(
        "--periods",
        default="1,5,10",
        help="前瞻收益持有期（逗号分隔交易日，默认: 1,5,10）",
    )
    p.add_argument(
        "--max-loss",
        type=float,
        default=0.35,
        help="get_clean_factor_and_forward_returns 的 max_loss（默认: 0.35）",
    )
    args = p.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"输入文件不存在: {args.input}")

    end_date = args.end_date or _default_end_date(args.input, args.date_column)
    start_date = args.start_date or _default_start_date(
        args.input, args.date_column)
    try:
        periods = tuple(
            int(x.strip()) for x in args.periods.split(",") if x.strip())
    except ValueError as e:
        raise SystemExit(f"无效的 --periods: {args.periods}") from e
    if not periods:
        raise SystemExit("--periods 至少需要一个整数")

    ds = CsvDataSource(
        args.input,
        date_column=args.date_column,
        asset_column=args.asset_column,
    )
    resolver = DependencyResolver()
    close_alias = {
        "close": args.close_column
    } if args.close_column != "close" else None
    resolver.register_datasource(ds, ["close"], alias=close_alias)

    factor = MomentumFactor(dependency_resolver=resolver)
    try:
        ev = AlphalensFactorEvaluator(
            factor,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as e:
        raise SystemExit(f"无法加载评估数据: {e}") from e

    result = ev.evaluate_factor(
        quantiles=args.quantiles,
        periods=periods,
        max_loss=args.max_loss,
    )
    col = result.factor_frame.columns[0]
    print(f"因子列: {col}，有效样本数: {result.factor_frame[col].notna().sum()}")

    m = result.metrics
    print("\n=== IC 按持有期（日度序列描述统计）===\n")
    print(m.ic_summary.to_string())

    print("\n=== 平均 IC（各前瞻期）===\n")
    print(m.mean_ic.to_string())

    print("\n=== 分位组合平均收益（demeaned，全样本平均）===\n")
    print(m.mean_return_by_quantile.to_string())
    print("\n=== 分位收益标准误 ===\n")
    print(m.mean_return_by_quantile_std_error.to_string())

    print("\n=== 最高分位减最低分位（spread）===\n")
    print(m.mean_return_spread.to_string())
    if m.mean_return_spread_std_error is not None:
        print("\n=== spread 标准误 ===\n")
        print(m.mean_return_spread_std_error.to_string())

    print("\n=== Alpha / Beta（因子组合 vs 截面均值）===\n")
    print(m.factor_alpha_beta.to_string())

    print("\n=== 因子秩自相关（period=1）===\n")
    print(m.factor_rank_autocorrelation.describe().to_string())


if __name__ == "__main__":
    main()
