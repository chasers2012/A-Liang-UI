from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from factor import FactorDataSource


class DataSourcePluginError(RuntimeError):
    pass


class UnknownDataSourceTypeError(DataSourcePluginError):
    def __init__(self, ds_type: str):
        super().__init__(f"Unknown datasource type: {ds_type!r}")
        self.ds_type = ds_type


@dataclass(frozen=True, slots=True)
class VerifyResult:
    ok: bool
    message: str


def redact_config(config: dict[str, Any]) -> dict[str, Any]:
    """
    Best-effort redact common secret fields in a nested config dict.

    Plugins can override this by returning a redacted config in their own public
    representation, but the API should always apply this as a safety net.
    """

    def _walk(v: Any) -> Any:
        if isinstance(v, dict):
            out: dict[str, Any] = {}
            for k, vv in v.items():
                lk = str(k).lower()
                if lk in {"password", "passwd", "secret", "token", "api_key", "apikey"}:
                    out[str(k)] = "***"
                else:
                    out[str(k)] = _walk(vv)
            return out
        if isinstance(v, list):
            return [_walk(x) for x in v]
        return v

    return _walk(dict(config))  # type: ignore[return-value]


@runtime_checkable
class DataSourcePlugin(Protocol):
    """
    Datasource plugin contract.

    Each plugin owns the schema and validation of its config blob.
    """

    type: str

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize config. Must return a JSON-serializable dict."""

    def to_factor_datasource(self, config: dict[str, Any]) -> FactorDataSource:
        """Build a FactorDataSource instance from validated config."""

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        """Verify connectivity/readability based on config."""
