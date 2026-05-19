from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

import pandas as pd


@dataclass(frozen=True, slots=True)
class VerifyResult:
    ok: bool
    message: str


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


class DataSource(ABC):
    """中性的 DataFrame 读取接口（不承载任何因子业务语义）。

    该接口只负责“从某个后端读取指定列，并应用通用过滤条件”，不出现
    ``date`` / ``asset`` / ``codes`` 等业务字段概念。
    业务侧的索引列语义（逻辑 date/asset）与字段映射（alias）
    由 :class:`factor.data_set.DataSet` / :class:`factor.data_set.DataSourceBinding`
    统一处理。
    """

    @abstractmethod
    def list_columns(self) -> list[str]:
        """返回数据源可见的物理列名（用于绑定/校验）。"""
        raise NotImplementedError

    @property
    @abstractmethod
    def date_column(self) -> str:
        """数据源中用于时间过滤与索引标准化的物理列名。"""
        raise NotImplementedError

    @property
    @abstractmethod
    def asset_column(self) -> str | None:
        """数据源中用于资产过滤与索引标准化的物理列名。"""
        raise NotImplementedError

    @abstractmethod
    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        """读取一个普通 DataFrame（不设 index，不做列重命名）。"""
        raise NotImplementedError

    @abstractmethod
    def write_data(self, df: pd.DataFrame) -> int:
        """将 DataFrame 写入数据源，返回实际写入的行数。"""
        raise NotImplementedError

    @abstractmethod
    def verify(self) -> VerifyResult:
        """校验连接或可读性（运行时探测，非配置表单校验）。"""
        raise NotImplementedError
