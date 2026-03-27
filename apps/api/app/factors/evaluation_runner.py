"""Run Alphalens evaluation for a factor using workspace panel data sources."""

from __future__ import annotations

import os
import traceback

import pandas as pd
from factor import DependencyResolver

from app.datasources.registry import get_by_id as ds_get_by_id
from app.datasources.registry import load_registry as load_datasource_registry
from app.datasources.schemas import DataSourceRecord
from app.datasources.sql_url import build_sqlalchemy_url
from app.evaluation.test_set_schemas import EvaluationTestSetRecord
from app.evaluation.test_sets_store import (
    get_by_id as test_set_get_by_id,
)
from app.evaluation.test_sets_store import (
    get_default_test_set,
)
from app.evaluation.test_sets_store import (
    load_file as load_test_sets_file,
)
from app.factors.evaluation_schemas import (
    FactorEvaluationSnapshot,
    FactorEvaluationWindow,
)
from app.factors.loader import load_factor_class
from app.factors.registry import get_by_id, load_registry, read_source
from app.factors.schemas import utc_now_iso


def _pick_default_datasource() -> DataSourceRecord | None:
    reg = load_datasource_registry()
    enabled = [r for r in reg.items if r.enabled]
    if not enabled:
        return None
    return enabled[0]


def _datasource_for_test_set(ds_id: str) -> DataSourceRecord:
    reg = load_datasource_registry()
    ds_rec = ds_get_by_id(reg, ds_id)
    if ds_rec is None:
        raise ValueError("数据源不存在或已删除，无法用于该测试集评价")
    if not ds_rec.enabled:
        raise ValueError("数据源未启用，无法用于该测试集评价")
    return ds_rec


def _stock_codes_from_test_set(codes: list[str]) -> list[str] | None:
    cleaned = [c.strip() for c in codes if str(c).strip()]
    return cleaned if cleaned else None


def _resolve_evaluation_context(
    explicit_test_set_id: str | None,
) -> tuple[
    EvaluationTestSetRecord | None,
    DataSourceRecord | None,
    str,
    str,
    list[str] | None,
    int,
]:
    """Resolve test set (if any), legacy single datasource, window, universe, default quantiles.

    Alphalens 分位数由环境变量 ``FACTOR_AGENT_QUANTILES``（默认 5）决定，不再从测试集读取。

    Order: explicit test_set_id → workspace default test set → env + default datasource.

    When the first tuple element is not None, use its ``datasource_bindings`` for evaluation;
    otherwise use the second element as the single panel source for all factor dependencies.
    """
    ts_id = (explicit_test_set_id or "").strip()
    ts_reg = load_test_sets_file()
    ts_rec: EvaluationTestSetRecord | None = None
    if ts_id:
        ts_rec = test_set_get_by_id(ts_reg, ts_id)
        if ts_rec is None:
            raise ValueError("测试集不存在")
    else:
        ts_rec = get_default_test_set(ts_reg)

    if ts_rec is not None:
        stock_codes = _stock_codes_from_test_set(list(ts_rec.stock_codes))
        q_default = int(os.environ.get("FACTOR_AGENT_QUANTILES", "5"))
        return (
            ts_rec,
            None,
            ts_rec.start,
            ts_rec.end,
            stock_codes,
            max(2, q_default),
        )

    ds_rec = _pick_default_datasource()
    if ds_rec is None:
        raise ValueError(
            "未找到已启用的数据源：请在「数据源」中配置并启用至少一个数据源（建议设默认）。"
        )
    start = os.environ.get(
        "FACTOR_AGENT_EVAL_START",
        os.environ.get("FACTOR_AGENT_START_DATE", "2023-01-01"),
    )
    end = os.environ.get(
        "FACTOR_AGENT_EVAL_END",
        os.environ.get("FACTOR_AGENT_END_DATE", "2024-12-31"),
    )
    codes_env = os.environ.get("FACTOR_AGENT_STOCK_CODES", "")
    stock_codes: list[str] | None = (
        [c.strip() for c in codes_env.split(",") if c.strip()] if codes_env else None
    )
    quantiles = int(os.environ.get("FACTOR_AGENT_QUANTILES", "5"))
    return None, ds_rec, start, end, stock_codes, quantiles


def _series_to_period_dict(s: pd.Series) -> dict[str, float]:
    out: dict[str, float] = {}
    for k, v in s.items():
        if pd.isna(v):
            continue
        key = str(int(k)) if isinstance(k, (int, float)) and float(k) == int(k) else str(k)
        out[key] = float(v)
    return out


def _stock_count_from_alignment(idx: pd.Index) -> int | None:
    if not isinstance(idx, pd.MultiIndex):
        return None
    try:
        lev = idx.get_level_values("asset")
    except (KeyError, IndexError, ValueError):
        try:
            lev = idx.get_level_values(-1)
        except Exception:
            return None
    return int(lev.nunique())


def _build_datasource(rec: DataSourceRecord):
    if rec.type == "sql" and rec.sql:
        from sql_datasource import SqlDataSource

        url = build_sqlalchemy_url(rec.sql)
        if not url:
            raise ValueError("SQL 数据源未配置有效连接")
        return SqlDataSource(
            engine=url,
            table=rec.sql.table,
            date_column=rec.sql.date_column,
            asset_column=rec.sql.asset_column,
            column_map=dict(rec.sql.column_map),
        )
    if rec.type == "csv" and rec.csv:
        from csv_datasource import CsvDataSource

        from app.datasources.registry import resolve_csv_path

        path = resolve_csv_path(rec.csv.path)
        return CsvDataSource(
            path,
            date_column=rec.csv.date_column,
            asset_column=rec.csv.asset_column,
            read_csv_kwargs=dict(rec.csv.read_csv_kwargs),
        )
    raise ValueError("数据源配置不完整")


def _eval_failure_tuple(
    error: str,
    *,
    window: FactorEvaluationWindow,
    quantiles: int,
    stock_codes: list[str] | None,
) -> tuple[
    FactorEvaluationSnapshot,
    None,
    FactorEvaluationWindow,
    int,
    list[str] | None,
]:
    snap = FactorEvaluationSnapshot(
        evaluated_at=utc_now_iso(),
        window=window,
        mean_ic={},
        mean_return_spread={},
        error=error,
    )
    return snap, None, window, quantiles, stock_codes


def _register_test_set_bindings(
    resolver: DependencyResolver,
    ts_rec: EvaluationTestSetRecord,
    deps: list[str],
    *,
    window: FactorEvaluationWindow,
    quantiles: int,
    stock_codes: list[str] | None,
) -> tuple[FactorEvaluationSnapshot, None, FactorEvaluationWindow, int, list[str] | None] | None:
    binds = list(ts_rec.datasource_bindings)
    if not binds:
        return _eval_failure_tuple(
            "测试集未配置数据源绑定",
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )
    n_b = len(binds)
    for b in binds:
        ds_rec = _datasource_for_test_set(b.datasource_id)
        panel_src = _build_datasource(ds_rec)
        fields = [x.strip() for x in b.dependencies if str(x).strip()]
        if not fields:
            if n_b > 1:
                return _eval_failure_tuple(
                    "测试集含多个数据源时，每条绑定须填写 dependencies",
                    window=window,
                    quantiles=quantiles,
                    stock_codes=stock_codes,
                )
            fields = list(deps)
        resolver.register_datasource(panel_src, fields)
    missing = [f for f in deps if resolver.source_for_field(f) is None]
    if missing:
        return _eval_failure_tuple(
            f"测试集数据源未覆盖因子依赖: {missing}",
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )
    return None


def _build_dependency_resolver(
    ts_rec: EvaluationTestSetRecord | None,
    legacy_ds: DataSourceRecord | None,
    deps: list[str],
    *,
    window: FactorEvaluationWindow,
    quantiles: int,
    stock_codes: list[str] | None,
) -> tuple[
    DependencyResolver | None,
    tuple[
        FactorEvaluationSnapshot,
        None,
        FactorEvaluationWindow,
        int,
        list[str] | None,
    ]
    | None,
]:
    resolver = DependencyResolver()
    try:
        if ts_rec is not None:
            err = _register_test_set_bindings(
                resolver,
                ts_rec,
                deps,
                window=window,
                quantiles=quantiles,
                stock_codes=stock_codes,
            )
            if err is not None:
                return None, err
        else:
            assert legacy_ds is not None
            panel_src = _build_datasource(legacy_ds)
            resolver.register_datasource(panel_src, deps)
    except ValueError as e:
        return None, _eval_failure_tuple(
            str(e), window=window, quantiles=quantiles, stock_codes=stock_codes
        )
    except Exception as e:
        return None, _eval_failure_tuple(
            f"数据源初始化失败: {e}",
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )
    return resolver, None


def _import_alphalens_evaluator():
    import matplotlib

    matplotlib.use("Agg")

    from evaluate import AlphalensFactorEvaluator

    return AlphalensFactorEvaluator


def build_alphalens_evaluator_for_factor(
    factor_id: str, *, test_set_id: str | None = None
) -> tuple[
    FactorEvaluationSnapshot | None,
    object | None,
    FactorEvaluationWindow,
    int,
    list[str] | None,
]:
    """Return (error_snapshot, evaluator, window, quantiles, stock_codes) on success error is None."""
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise ValueError("因子不存在")

    ts_rec, legacy_ds, start, end, stock_codes, quantiles = _resolve_evaluation_context(test_set_id)
    window = FactorEvaluationWindow(start=start, end=end)

    src = read_source(rec)
    try:
        cls, _ = load_factor_class(src)
    except ValueError as e:
        return _eval_failure_tuple(
            str(e), window=window, quantiles=quantiles, stock_codes=stock_codes
        )

    deps = list(cls.dependencies)
    if not deps:
        return _eval_failure_tuple(
            "因子 dependencies 为空",
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )

    resolver, fail = _build_dependency_resolver(
        ts_rec, legacy_ds, deps, window=window, quantiles=quantiles, stock_codes=stock_codes
    )
    if fail is not None:
        return fail
    assert resolver is not None

    inst = cls(dependency_resolver=resolver)

    try:
        AlphalensFactorEvaluator = _import_alphalens_evaluator()
    except Exception as e:
        return _eval_failure_tuple(
            f"评价依赖未就绪: {e}",
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )

    ev = AlphalensFactorEvaluator(
        inst,
        start_date=start,
        end_date=end,
        stock_codes=stock_codes,
        long_short=True,
    )
    return None, ev, window, quantiles, stock_codes


def run_evaluation_for_factor(
    factor_id: str,
    *,
    test_set_id: str | None = None,
    evaluation_profile: object | None = None,
) -> FactorEvaluationSnapshot:
    from app.evaluation.profile_schemas import EvaluationProfileRecord

    merged_ts = (test_set_id or "").strip() or None
    if (
        evaluation_profile is not None
        and isinstance(evaluation_profile, EvaluationProfileRecord)
        and evaluation_profile.test_set_id
        and merged_ts is None
    ):
        merged_ts = evaluation_profile.test_set_id.strip() or None

    if (
        evaluation_profile is not None
        and isinstance(evaluation_profile, EvaluationProfileRecord)
        and evaluation_profile.workflow.nodes
    ):
        from app.evaluation.workflow_runner import run_evaluation_profile_workflow

        return run_evaluation_profile_workflow(
            factor_id,
            evaluation_profile,
            test_set_id=merged_ts,
        )

    err, ev, window, quantiles, _ = build_alphalens_evaluator_for_factor(
        factor_id, test_set_id=merged_ts
    )
    if err is not None:
        snap = err
        if evaluation_profile is not None and isinstance(
            evaluation_profile, EvaluationProfileRecord
        ):
            snap = snap.model_copy(update={"evaluation_profile_id": evaluation_profile.id})
        return snap
    assert ev is not None

    prep_periods = (1, 5, 10, 20)
    prep_q: int | None = None
    long_short = True
    max_loss = 0.5
    if evaluation_profile is not None and isinstance(evaluation_profile, EvaluationProfileRecord):
        pr = evaluation_profile.prepare
        prep_periods = tuple(int(x) for x in pr.forward_return_periods)
        prep_q = pr.quantiles
        long_short = pr.long_short
        max_loss = pr.max_loss

    q_use = prep_q if prep_q is not None else quantiles
    try:
        ev_eval = ev
        ev_eval.long_short = long_short
        n_stocks = _stock_count_from_alignment(ev_eval.alignment_index())
        out = ev_eval.evaluate_factor(
            quantiles=q_use,
            periods=prep_periods,
            max_loss=max_loss,
        )
        mean_ic = _series_to_period_dict(out.metrics.mean_ic)
        mean_spread = _series_to_period_dict(out.metrics.mean_return_spread)
        pid = (
            evaluation_profile.id
            if evaluation_profile is not None
            and isinstance(evaluation_profile, EvaluationProfileRecord)
            else None
        )
        return FactorEvaluationSnapshot(
            evaluated_at=utc_now_iso(),
            window=window,
            stock_count=n_stocks,
            mean_ic=mean_ic,
            mean_return_spread=mean_spread,
            error=None,
            evaluation_profile_id=pid,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return FactorEvaluationSnapshot(
            evaluated_at=utc_now_iso(),
            window=window,
            mean_ic={},
            mean_return_spread={},
            error=f"{e}\n{tb}",
        )
