from __future__ import annotations

import pandas as pd

from factor.data_set import DataSet


def _trading_lookback_bdays(window: int, *, tail_extra: int = 0) -> int:
    """
    Business days to step back for a nominal ``window`` (bars / lookback length).

    Adds slack on top of ``window`` because calendars have holidays and panels
    may omit non-trading days; pure ``BDay(window)`` can be too tight.
    """
    w = max(int(window), 0)
    if w == 0:
        return tail_extra
    slack = max(3, (w + 2) // 3)
    return w + slack + tail_extra


def panel_load_start_date(start_date: str | None, end_date: str, window: int) -> str:
    """
    Earliest inclusive calendar date (``YYYY-MM-DD``) to pass to
    :meth:`FactorDataSource.get_panel` for the user-visible ``start_date`` /
    ``end_date`` and factor ``window``.

    When ``start_date`` is None (factor "last day only" semantics), history is
    anchored on ``end_date`` instead.
    """
    end_ts = pd.Timestamp(end_date).normalize()
    w = max(int(window), 0)
    if start_date:
        s = pd.Timestamp(start_date).normalize()
        if w == 0:
            ts = s
        else:
            n = _trading_lookback_bdays(w)
            ts = (s - pd.offsets.BDay(n)).normalize()
    else:
        if w == 0:
            ts = end_ts
        else:
            n = _trading_lookback_bdays(w, tail_extra=1)
            ts = (end_ts - pd.offsets.BDay(n)).normalize()
    return ts.strftime("%Y-%m-%d")


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
        start_date: str | None,
        end_date: str,
        stock_codes: list[str] | None,
        window: int,
    ) -> pd.DataFrame:
        return self._data_set.get_panel(
            fields=fields,
            start_date=start_date,
            end_date=end_date,
            stock_codes=stock_codes,
            window=window,
        )
