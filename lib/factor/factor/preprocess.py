from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Protocol

import pandas as pd


class DataPreprocessor(Protocol):
    """A raw-frame preprocessor that can read multiple datasources at once.

    Contract:
    - Input/Output frames are *raw* (physical column names, no index set).
    - Keys are stable binding identifiers (recommended: datasource_id).
    - Implementations should not remove required index columns for any binding
      that participates in the current panel request.
    """

    def transform(
        self,
        frames: dict[str, pd.DataFrame],
        *,
        config: dict[str, Any],
    ) -> dict[str, pd.DataFrame]: ...


class DataPreprocessorBase(ABC):
    """Base class for user-defined preprocessors loaded from source files."""

    @abstractmethod
    def transform(
        self,
        frames: dict[str, pd.DataFrame],
        *,
        config: dict[str, Any],
    ) -> dict[str, pd.DataFrame]:
        raise NotImplementedError


@dataclass(frozen=True, slots=True)
class DataSetPreprocessorBinding:
    """Resolved preprocessor binding used by :class:`factor.data_set.DataSet`."""

    preprocessor: DataPreprocessor
    config: dict[str, Any]
    datasource_ids: list[str] | None = None
