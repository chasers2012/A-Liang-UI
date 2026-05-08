from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

import pandas as pd


@dataclass(frozen=True, slots=True)
class BetweenFilter:
    column: str
    start: str
    end: str
    inclusive: Literal["both", "left", "right", "neither"] = "both"


@dataclass(frozen=True, slots=True)
class InFilter:
    column: str
    values: list[str]


LoadFilter = BetweenFilter | InFilter


class FactorDataSource(ABC):
    """中性的 DataFrame 读取接口（不承载任何因子业务语义）。

    该接口只负责“从某个后端读取指定列，并应用通用过滤条件”，不出现
    ``date`` / ``asset`` / ``codes`` / ``column_map`` 等业务字段概念。
    业务侧的索引列语义（逻辑 date/asset）与字段映射（alias/column_map）
    由 :class:`factor.data_set.DataSet` / :class:`factor.data_set.DataSourceBinding`
    统一处理。
    """

    @abstractmethod
    def list_columns(self) -> list[str]:
        """返回数据源可见的物理列名（用于绑定/校验）。"""
        raise NotImplementedError

    @abstractmethod
    def load_frame(
        self,
        *,
        columns: list[str],
        date_column: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        asset_column: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        """读取一个普通 DataFrame（不设 index，不做列重命名）。"""
        raise NotImplementedError
