/** Mirrors server `default_factor_source` for new-factor editor defaults. */
export function defaultFactorSource(factorName: string): string {
  const safe = factorName.trim() || "my_factor";
  return `from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class UserFactor(Factor):
    name = "${safe}"
    group = "custom"
    group_label = "自定义"
    description = "在此实现 calc"
    dependencies = ["close"]
    max_window = 2

    def calc(self, data: pd.DataFrame) -> pd.Series:
        close = data["close"]
        return close.groupby(level="asset", group_keys=False).pct_change(periods=1)
`;
}
