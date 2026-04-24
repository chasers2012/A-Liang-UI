from __future__ import annotations

import inspect
import math
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

if TYPE_CHECKING:
    from factor.dependency_resolver import DependencyResolver


class Factor(ABC):
    """
    Factor base class.

    新建因子时建议按这个模板实现：

    .. code-block:: python

        class MyFactor(Factor):
            name = "my_factor"
            label = "我的因子"
            group = "factor"
            description = "因子说明"
            param_specs = (
                {"name": "window", "label": "窗口", "default": 20, "min": 1, "max": 250},
            )

            @property
            def window(self) -> int:
                return int(self.params["window"])

            def calc(self, close: pd.DataFrame) -> pd.DataFrame:
                window = int(self.params["window"])
                return close.rolling(window).mean()

    Subclasses define:
    - ``name``: factor id
    - ``group``: registry grouping (optional override; default ``"factor"``)
    - ``window``: maximum lookback length
    - ``calc(**kwargs)``: compute values from dependency wide DataFrame (index=date, columns=asset)
    """

    name: str = "factor"
    label: str = "因子"
    group: str = "factor"
    description: str = "因子描述"

    @property
    def window(self) -> int:
        return 1

    # 显式参数定义；仅支持数值参数（int/float）。
    param_specs: tuple[dict[str, Any], ...] = ()

    @classmethod
    def _normalize_param_spec_item(cls, item: dict[str, Any]) -> dict[str, Any] | None:
        name = str(item.get("name") or "").strip()
        if not name:
            return None

        v_min = item.get("min", item.get("minimum"))
        v_max = item.get("max", item.get("maximum"))
        if v_min is None or v_max is None:
            raise ValueError(f"Factor {cls.name}: param spec '{name}' must set both min and max")

        spec: dict[str, Any] = {
            "name": name,
            "label": str(item.get("label") or name),
            "description": str(item.get("description") or ""),
        }

        def put_number(k_out: str, v: Any) -> None:
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
                raise ValueError(
                    f"Factor {cls.name}: param spec '{name}' field '{k_out}' must be finite number"
                )
            spec[k_out] = v

        if "default" in item and item["default"] is not None:
            put_number("default", item["default"])
        put_number("min", v_min)
        put_number("max", v_max)

        if spec["min"] > spec["max"]:
            raise ValueError(f"Factor {cls.name}: param spec '{name}' min must be <= max")
        return spec

    def __init__(
        self,
        *,
        dependency_resolver: DependencyResolver | None = None,
        params: dict[str, Any] | None = None,
    ) -> None:
        self._dependency_resolver = dependency_resolver
        self.params: dict[str, Any] = {}
        self._init_params_with_defaults()
        if params:
            self.apply_params(params)

    @classmethod
    def get_param_specs(cls) -> dict[str, dict[str, Any]]:
        raw = getattr(cls, "param_specs", None)
        if not isinstance(raw, (list, tuple)):
            return ()

        out: list[dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            spec = cls._normalize_param_spec_item(item)
            if spec is None:
                continue
            out.append(spec)

        return tuple(out)

    def _init_params_with_defaults(self) -> None:
        for spec in self.get_param_specs():
            if not isinstance(spec, dict):
                continue
            name = str(spec.get("name") or "").strip()
            if not name or "default" not in spec:
                continue
            default_value = spec.get("default")
            self.params[name] = default_value
            setattr(self, name, default_value)

    def apply_params(self, params: dict[str, Any]) -> None:
        """Merge runtime params and apply safe attribute overrides."""
        if not isinstance(params, dict):
            raise ValueError(f"Factor {self.name}: params must be a dict")
        spec_map = {
            s["name"]: s for s in self.get_param_specs() if isinstance(s, dict) and s.get("name")
        }
        for key, value in params.items():
            if not isinstance(key, str) or not key.strip():
                continue
            if key not in spec_map:
                raise ValueError(f"Factor {self.name}: unknown param '{key}'")
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
            ):
                raise ValueError(f"Factor {self.name}: param '{key}' must be finite number")
            spec = spec_map[key]
            v_min = spec.get("min")
            v_max = spec.get("max")
            if v_min is not None and value < v_min:
                raise ValueError(f"Factor {self.name}: param '{key}' must be >= {v_min}")
            if v_max is not None and value > v_max:
                raise ValueError(f"Factor {self.name}: param '{key}' must be <= {v_max}")
            self.params[key] = value
            setattr(self, key, value)

    def _get_dependencies(self) -> list[str]:
        """
        Determine dependency field names for this factor.

        Notes:
        - ``**kwargs`` is allowed as an extra sink and is ignored for dependency inference.
        - If ``calc`` only declares ``**kwargs`` and no named parameters, inference fails.
        """
        sig = inspect.signature(self.calc)
        deps: list[str] = []
        for p in sig.parameters.values():
            if p.name == "self":
                continue
            if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.VAR_POSITIONAL):
                raise ValueError(
                    f"Factor {self.name}: calc must not use positional-only/*args; "
                    "declare dependencies as named parameters (e.g. calc(self, close, volume, **kwargs))."
                )
            if p.kind == inspect.Parameter.VAR_KEYWORD:
                continue
            deps.append(p.name)

        if not deps:
            raise ValueError(
                f"Factor {self.name}: cannot infer dependencies from calc signature. "
                "Declare them as named parameters (e.g. calc(self, close, **kwargs))."
            )
        return deps

    def dependency_fields(self) -> list[str]:
        """Dependency field names inferred from ``calc`` signature."""
        return self._get_dependencies()

    @abstractmethod
    def calc(self, **kwargs: pd.DataFrame) -> pd.DataFrame:
        """
        Compute factor values (must implement).

        Args:
            **kwargs: One wide DataFrame per dependency field, passed by name.
                Each value has index ``date`` and columns ``asset``.
                Example: a factor declaring ``calc(self, close, **kwargs)`` will receive ``close=...``.

        Returns:
            Wide DataFrame with index ``date`` and columns ``asset``.
        """
        raise NotImplementedError

    def _validate_calculate_panel(self, price_data: pd.DataFrame) -> None:
        if not isinstance(price_data.index, pd.MultiIndex):
            raise ValueError(f"Factor {self.name}: price_data must have MultiIndex (date, asset)")

        index_names = price_data.index.names
        if "date" not in index_names or "asset" not in index_names:
            raise ValueError(f"Factor {self.name}: MultiIndex must have 'date' and 'asset' levels")

        deps = self._get_dependencies()
        missing_cols = set(deps) - set(price_data.columns)
        if missing_cols:
            raise ValueError(f"Factor {self.name}: missing required columns: {missing_cols}")

    def _normalize_calc_output_to_frame(
        self,
        result: pd.DataFrame,
        price_data: pd.DataFrame,
    ) -> pd.DataFrame:
        if not isinstance(result, pd.DataFrame):
            raise ValueError(
                f"Factor {self.name}: calc must return a wide DataFrame with index=date and columns=asset"
            )
        if isinstance(result.index, pd.MultiIndex):
            raise ValueError(
                f"Factor {self.name}: calc must return wide DataFrame (index=date, columns=asset), not MultiIndex"
            )
        expected = price_data.index.to_frame(index=False)
        expected["date"] = pd.to_datetime(expected["date"])
        expected["asset"] = expected["asset"].astype(str)
        expected_dates = pd.Index(expected["date"].unique(), name="date")
        expected_assets = pd.Index(expected["asset"].unique(), name="asset")
        out = result.copy()
        out.index = pd.to_datetime(out.index)
        out = out.reindex(index=expected_dates, columns=expected_assets)
        out.columns.name = "asset"
        out.index.name = "date"
        return out

    def _panel_to_dependency_wide(
        self,
        price_data: pd.DataFrame,
        dep_names: list[str],
    ) -> dict[str, pd.DataFrame]:
        out: dict[str, pd.DataFrame] = {}
        for name in dep_names:
            wide = price_data[name].unstack(level="asset")
            wide.columns.name = "asset"
            out[name] = wide
        return out

    def _slice_result_by_request_dates(
        self,
        result: pd.DataFrame,
        start_date: str | None,
        end_date: str,
    ) -> pd.DataFrame:
        date_level = result.index
        end_dt = pd.to_datetime(end_date) if end_date is not None else None
        if start_date:
            start_dt = pd.to_datetime(start_date)
            mask = (date_level >= start_dt) & (date_level <= end_dt if end_dt is not None else True)
            return result.loc[mask]

        dl = result.index
        if end_dt is not None:
            mask_end = np.asarray(dl <= end_dt, dtype=bool)
        else:
            mask_end = np.ones(len(dl), dtype=bool)
        if mask_end.any():
            last_day = dl[mask_end].max()
            return result.loc[result.index == last_day]
        return result.iloc[0:0]

    def calculate(
        self,
        start_date: str | None,
        end_date: str,
        instrument_codes: list[str] | None = None,
        *,
        dependency_resolver: DependencyResolver | None = None,
    ) -> pd.DataFrame:
        """
        Load panel data via :class:`DependencyResolver` and run ``calc``.

        Args:
            start_date: ``YYYY-MM-DD``, or None / empty to keep only the last
                available date (not after ``end_date`` when set).
            end_date: ``YYYY-MM-DD``
            instrument_codes: Instruments (assets) to include, or None for full universe.
            dependency_resolver: Override instance :class:`DependencyResolver` for this call.

        Returns:
            Wide DataFrame with index ``date`` and columns ``asset``.
        """
        price_data = self._load_data(
            start_date,
            end_date,
            instrument_codes,
            dependency_resolver=dependency_resolver,
        )

        self._validate_calculate_panel(price_data)
        dep_names = self._get_dependencies()
        deps = self._panel_to_dependency_wide(price_data, dep_names)
        raw = self.calc(**deps)
        framed = self._normalize_calc_output_to_frame(raw, price_data)
        return self._slice_result_by_request_dates(framed, start_date, end_date)

    def calculate_from_data(self, price_data: pd.DataFrame) -> pd.DataFrame:
        """
        Compute from an existing panel (evaluator-style), returning wide DataFrame.

        Args:
            price_data: MultiIndex (date, asset) with ``dependencies``.

        Returns:
            Wide DataFrame with index ``date`` and columns ``asset``.
        """
        if not isinstance(price_data.index, pd.MultiIndex):
            raise ValueError(f"Factor {self.name}: price_data must have MultiIndex (date, asset)")

        index_names = price_data.index.names
        if "date" not in index_names or "asset" not in index_names:
            raise ValueError(f"Factor {self.name}: MultiIndex must have 'date' and 'asset' levels")

        dep_names = self._get_dependencies()
        missing_cols = set(dep_names) - set(price_data.columns)
        if missing_cols:
            raise ValueError(f"Factor {self.name}: missing required columns: {missing_cols}")

        deps = self._panel_to_dependency_wide(price_data, dep_names)
        result = self.calc(**deps)
        return self._normalize_calc_output_to_frame(result, price_data)

    def __call__(
        self,
        start_date: str | None,
        end_date: str,
        instrument_codes: list[str] | None = None,
        *,
        dependency_resolver: DependencyResolver | None = None,
    ) -> pd.DataFrame:
        return self.calculate(
            start_date,
            end_date,
            instrument_codes,
            dependency_resolver=dependency_resolver,
        )

    def _load_data(
        self,
        start_date: str | None,
        end_date: str,
        instrument_codes: list[str] | None = None,
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

        deps = dependencies if dependencies is not None else self._get_dependencies()
        return resolver.get_panel(
            fields=deps,
            start_date=start_date,
            end_date=end_date,
            instrument_codes=instrument_codes,
            window=self.window + 1,
        )
