from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, ClassVar

import numpy as np
import pandas as pd

if TYPE_CHECKING:
    from factor.dependency_resolver import DependencyResolver


class Factor(ABC):
    """
    Factor base class.

    Subclasses define:
    - ``name``: factor id
    - ``group``: registry grouping (optional override; default ``"factor"``)
    - ``max_window``: maximum lookback length
    - ``dependencies``: required column names in the panel
    - ``calc(data)``: compute values from a MultiIndex (date, asset) DataFrame
    """

    name: str = "factor"
    label: str = "因子"
    group: str = "factor"
    description: str = "因子描述"
    max_window: int = 1
    dependencies: ClassVar[list[str]] = ["close"]

    def __init__(
        self,
        *,
        dependency_resolver: DependencyResolver | None = None,
    ) -> None:
        self._dependency_resolver = dependency_resolver

    @abstractmethod
    def calc(self, data: pd.DataFrame) -> pd.Series | pd.DataFrame:
        """
        Compute factor values (must implement).

        Args:
            data: MultiIndex DataFrame (date, asset) with ``dependencies`` columns.

        Returns:
            Series or DataFrame with MultiIndex (date, asset).
            - Single-column results are renamed to ``name`` where noted below.
        """
        raise NotImplementedError

    def _validate_calculate_panel(self, price_data: pd.DataFrame) -> None:
        if not isinstance(price_data.index, pd.MultiIndex):
            raise ValueError(f"Factor {self.name}: price_data must have MultiIndex (date, asset)")

        index_names = price_data.index.names
        if "date" not in index_names or "asset" not in index_names:
            raise ValueError(f"Factor {self.name}: MultiIndex must have 'date' and 'asset' levels")

        missing_cols = set(self.dependencies) - set(price_data.columns)
        if missing_cols:
            raise ValueError(f"Factor {self.name}: missing required columns: {missing_cols}")

    def _normalize_calc_output_to_frame(
        self,
        result: pd.Series | pd.DataFrame,
        price_data: pd.DataFrame,
    ) -> pd.DataFrame:
        if not isinstance(result, (pd.DataFrame, pd.Series)):
            raise ValueError(f"Factor {self.name}: calc must return a DataFrame or Series")

        if not isinstance(result.index, pd.MultiIndex):
            raise ValueError(f"Factor {self.name}: calc result must have MultiIndex (date, asset)")

        if isinstance(result, pd.Series):
            out = pd.DataFrame({self.name: result})
        elif len(result.columns) == 1:
            out = result.copy()
            out.columns = [self.name]
        else:
            out = result
        return out.reindex(price_data.index)

    def _slice_result_by_request_dates(
        self,
        result: pd.DataFrame,
        start_date: str | None,
        end_date: str,
    ) -> pd.DataFrame:
        date_level = result.index.get_level_values("date")
        end_dt = pd.to_datetime(end_date) if end_date is not None else None
        if start_date:
            start_dt = pd.to_datetime(start_date)
            mask = (date_level >= start_dt) & (date_level <= end_dt if end_dt is not None else True)
            return result.loc[mask]

        dl = result.index.get_level_values("date")
        if end_dt is not None:
            mask_end = np.asarray(dl <= end_dt, dtype=bool)
        else:
            mask_end = np.ones(len(dl), dtype=bool)
        if mask_end.any():
            last_day = dl[mask_end].max()
            return result.loc[result.index.get_level_values("date") == last_day]
        return result.iloc[0:0]

    def calculate(
        self,
        start_date: str | None,
        end_date: str,
        stock_codes: list[str] | None = None,
        *,
        dependency_resolver: DependencyResolver | None = None,
    ) -> pd.DataFrame:
        """
        Load panel data via :class:`DependencyResolver` and run ``calc``.

        Args:
            start_date: ``YYYY-MM-DD``, or None / empty to keep only the last
                available date (not after ``end_date`` when set).
            end_date: ``YYYY-MM-DD``
            stock_codes: Assets to include, or None for full universe.
            dependency_resolver: Override instance :class:`DependencyResolver` for this call.

        Returns:
            DataFrame, MultiIndex (date, asset), columns named per ``calc`` rules.
        """
        price_data = self._load_data(
            start_date,
            end_date,
            stock_codes,
            dependency_resolver=dependency_resolver,
        )

        self._validate_calculate_panel(price_data)
        raw = self.calc(price_data)
        framed = self._normalize_calc_output_to_frame(raw, price_data)
        return self._slice_result_by_request_dates(framed, start_date, end_date)

    def calculate_from_data(self, price_data: pd.DataFrame) -> pd.Series:
        """
        Compute from an existing panel (evaluator-style), returning a single Series.

        Args:
            price_data: MultiIndex (date, asset) with ``dependencies``.

        Returns:
            Series, MultiIndex (date, asset), name set to ``name``.
        """
        if not isinstance(price_data.index, pd.MultiIndex):
            raise ValueError(f"Factor {self.name}: price_data must have MultiIndex (date, asset)")

        index_names = price_data.index.names
        if "date" not in index_names or "asset" not in index_names:
            raise ValueError(f"Factor {self.name}: MultiIndex must have 'date' and 'asset' levels")

        missing_cols = set(self.dependencies) - set(price_data.columns)
        if missing_cols:
            raise ValueError(f"Factor {self.name}: missing required columns: {missing_cols}")

        result = self.calc(price_data)

        if not isinstance(result, (pd.DataFrame, pd.Series)):
            raise ValueError(f"Factor {self.name}: calc must return a DataFrame or Series")

        if not isinstance(result.index, pd.MultiIndex):
            raise ValueError(f"Factor {self.name}: calc result must have MultiIndex (date, asset)")

        if isinstance(result, pd.DataFrame):
            if len(result.columns) > 0:
                result = result.iloc[:, 0]
            else:
                raise ValueError(
                    f"Factor {self.name}: calc result DataFrame must have at least one column"
                )

        result = result.reindex(price_data.index)
        result.name = self.name

        return result

    def __call__(
        self,
        start_date: str | None,
        end_date: str,
        stock_codes: list[str] | None = None,
        *,
        dependency_resolver: DependencyResolver | None = None,
    ) -> pd.DataFrame:
        return self.calculate(
            start_date,
            end_date,
            stock_codes,
            dependency_resolver=dependency_resolver,
        )

    def _load_data(
        self,
        start_date: str | None,
        end_date: str,
        stock_codes: list[str] | None = None,
        dependencies: list[str] | None = None,
        *,
        dependency_resolver: DependencyResolver | None = None,
    ) -> pd.DataFrame:
        resolver: DependencyResolver | None = (
            dependency_resolver if dependency_resolver is not None else self._dependency_resolver
        )
        if resolver is None:
            raise ValueError(
                f"Factor {self.name}: set dependency_resolver in __init__, "
                "or pass dependency_resolver= to calculate()"
            )

        deps = dependencies if dependencies is not None else self.dependencies
        return resolver.get_panel(
            fields=deps,
            start_date=start_date,
            end_date=end_date,
            stock_codes=stock_codes,
            window=self.max_window,
        )
