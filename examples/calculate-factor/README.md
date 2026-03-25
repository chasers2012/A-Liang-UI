# calculate-factor 示例

用 [lib/evaluate](../../lib/evaluate) 与 [lib/datasource-csv](../../lib/datasource-csv) 从 CSV 行情计算一个简单的 **PriceFactor**（因子值等于收盘价），并把结果写成 CSV。

## 内容说明

| 文件 | 说明 |
|------|------|
| `price_factor.py` | `PriceFactor`：继承 `factor.core.Factor`，`calc` 返回 `close` 列 |
| `run.py` | 命令行：读入 CSV、调用 `compute_factor_values_from_source`、写出结果 |
| `sample_bars.csv` | 最小示例数据（列：`date`, `asset`, `close`） |

## 环境

在仓库根目录 `quant-agent` 下执行，且已安装工作区依赖（例如 `uv sync`，dev 组包含 `evaluate`、`datasource-csv`）。

## 快速运行

```bash
uv run python examples/calculate-factor/run.py \
  -i examples/calculate-factor/sample_bars.csv \
  -o out.csv \
  --end-date 2025-01-03
```

输出列为 `date`, `asset`, `price`（`price` 为因子名，数值来自收盘价）。

## 命令行参数

- **必选**：`-i` / `--input` 输入 CSV，`-o` / `--output` 输出 CSV，`--end-date` 结束日 `YYYY-MM-DD`（含）。
- **可选**：`--start-date`；`--date-column`、`--asset-column`（默认均为 `date` / `asset`）；`--close-column`（默认 `close`，会映射为因子依赖名 `close`）。

若 CSV 表头与上述不一致，必须通过对应参数对齐，否则 `CsvFactorDataSource` 会报错并列出「文件中实际存在的列名」。

示例：表头为 `d,sym,c` 时：

```bash
uv run python examples/calculate-factor/run.py -i bars.csv -o out.csv \
  --date-column d --asset-column sym --close-column c \
  --end-date 2025-01-03
```

## 输入 CSV 形态

长表：一行表示某日某标的，至少包含日期列、资产代码列、收盘价列（或通过 `--close-column` 指定列名）。默认使用 UTF-8；带 BOM 的文件也可正常读取（`datasource-csv` 默认 `utf-8-sig`）。
