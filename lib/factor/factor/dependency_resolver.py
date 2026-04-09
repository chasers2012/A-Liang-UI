from __future__ import annotations

from typing import TYPE_CHECKING

import pandas as pd

if TYPE_CHECKING:
    from factor.data_set import DataSet


class DependencyResolver:
    """只负责委托给 :class:`factor.data_set.DataSet` 的轻量解析器。"""

    def __init__(self, data_set: DataSet) -> None:
        self._data_set = data_set

    @property
    def data_set(self) -> DataSet:
        return self._data_set

    def list_registered_fields(self) -> list[str]:
        return self._data_set.list_registered_fields()

    def get_panel(
        self,
        *,
        fields: list[str],
        window: int,
        start_date: str | None = None,
        end_date: str | None = None,
        stock_codes: list[str] | None = None,
    ) -> pd.DataFrame:
        return self._data_set.get_panel(
            fields=fields,
            window=window,
            start_date=start_date,
            end_date=end_date,
            stock_codes=stock_codes,
        )
