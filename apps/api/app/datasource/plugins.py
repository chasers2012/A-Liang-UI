from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import Any

from factor import FactorDataSource

from app.plugin.base import Plugin

__all__ = [
    "DataSourcePlugin",
    "UnknownDataSourceTypeError",
    "VerifyResult",
]


@dataclass(frozen=True, slots=True)
class VerifyResult:
    ok: bool
    message: str


class UnknownDataSourceTypeError(RuntimeError):
    def __init__(self, ds_type: str):
        super().__init__(f"Unknown datasource type: {ds_type!r}")
        self.ds_type = ds_type


class DataSourcePlugin(Plugin):
    """
    Datasource plugin: validates config, verifies connectivity, builds a FactorDataSource.
    """

    catelog = "datasource"

    @abstractmethod
    def verify(self, config: dict[str, Any]) -> VerifyResult:
        """Check connectivity or readability for the given config."""

    @abstractmethod
    def to_factor_datasource(self, config: dict[str, Any]) -> FactorDataSource:
        """Build a FactorDataSource instance from validated config."""
