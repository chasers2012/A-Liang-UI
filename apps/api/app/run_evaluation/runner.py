"""Run Alphalens evaluation for a factor using workspace panel data sources."""

from __future__ import annotations

import os
import traceback

import pandas as pd
from factor import DependencyResolver, load_factor_class

from app.data_set.data_set_schemas import DataSetRecord
from app.data_set.data_sets_store import DataSetsStore
from app.datasources.registry import DataSourceItemsRegistry
from app.datasources.schemas import DataSourceRecord
from app.datasources.sql_url import build_sqlalchemy_url
from app.factors.registry import FactorItemsRegistry, read_source
from app.factors.schemas import utc_now_iso
from app.run_evaluation.schemas import (
    FactorEvaluationSnapshot,
    FactorEvaluationWindow,
)


def _datasource_for_data_set(ds_id: str) -> DataSourceRecord:
    ds_rec = DataSourceItemsRegistry.get_item(ds_id)
    if ds_rec is None:
        raise ValueError("数据源不存在或已删除，无法用于该数据集评价")
    if not ds_rec.enabled:
        raise ValueError("数据源未启用，无法用于该数据集评价")
    return ds_rec


def _stock_codes_from_data_set(codes: list[str]) -> list[str] | None:
    cleaned = [c.strip() for c in codes if str(c).strip()]
    return cleaned if cleaned else None


def _resolve_evaluation_context(
    explicit_data_set_id: str | None,
) -> tuple[
    DataSetRecord,
    str,
    str,
    list[str] | None,
    int,
]:
    """Resolve data set, window, universe, quantiles (from env, default 5)."""
    rid = (explicit_data_set_id or "").strip()
    if not rid:
        raise ValueError(
            "未指定评价数据集：请在请求中传入 data_set_id，或使用已绑定 data_set_id 的评价方案。"
        )
    ds_rec = DataSetsStore.get_item(rid)
    if ds_rec is None:
        raise ValueError("数据集不存在")

    stock_codes = _stock_codes_from_data_set(list(ds_rec.stock_codes))
    q_default = int(os.environ.get("FACTOR_AGENT_QUANTILES", "5"))
    return (
        ds_rec,
        ds_rec.start,
        ds_rec.end,
        stock_codes,
        max(2, q_default),
    )


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


def _register_data_set_bindings(
    resolver: DependencyResolver,
    ds_rec: DataSetRecord,
    deps: list[str],
    *,
    window: FactorEvaluationWindow,
    quantiles: int,
    stock_codes: list[str] | None,
) -> tuple[FactorEvaluationSnapshot, None, FactorEvaluationWindow, int, list[str] | None] | None:
    binds = list(ds_rec.datasource_bindings)
    if not binds:
        return _eval_failure_tuple(
            "数据集未配置数据源绑定",
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )
    n_b = len(binds)
    for b in binds:
        ds_rec = _datasource_for_data_set(b.datasource_id)
        panel_src = _build_datasource(ds_rec)
        fields = [x.strip() for x in b.dependencies if str(x).strip()]
        if not fields:
            if n_b > 1:
                return _eval_failure_tuple(
                    "数据集含多个数据源时，每条绑定须填写 dependencies",
                    window=window,
                    quantiles=quantiles,
                    stock_codes=stock_codes,
                )
            fields = list(deps)
        resolver.register_datasource(panel_src, fields)
    missing = [f for f in deps if resolver.source_for_field(f) is None]
    if missing:
        return _eval_failure_tuple(
            f"数据集数据源未覆盖因子依赖: {missing}",
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )
    return None


def _build_dependency_resolver(
    ds_rec: DataSetRecord,
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
        err = _register_data_set_bindings(
            resolver,
            ds_rec,
            deps,
            window=window,
            quantiles=quantiles,
            stock_codes=stock_codes,
        )
        if err is not None:
            return None, err
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
    factor_id: str, *, data_set_id: str | None = None
) -> tuple[
    FactorEvaluationSnapshot | None,
    object | None,
    FactorEvaluationWindow,
    int,
    list[str] | None,
]:
    """Return (error_snapshot, evaluator, window, quantiles, stock_codes) on success error is None."""
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise ValueError("因子不存在")

    ds_rec, start, end, stock_codes, quantiles = _resolve_evaluation_context(data_set_id)
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
        ds_rec, deps, window=window, quantiles=quantiles, stock_codes=stock_codes
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
    data_set_id: str | None = None,
    evaluation_profile: object | None = None,
) -> FactorEvaluationSnapshot:
    from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord

    merged_data_set_id = (data_set_id or "").strip() or None
    if (
        evaluation_profile is not None
        and isinstance(evaluation_profile, EvaluationProfileRecord)
        and evaluation_profile.data_set_id
        and merged_data_set_id is None
    ):
        merged_data_set_id = evaluation_profile.data_set_id.strip() or None

    if (
        evaluation_profile is not None
        and isinstance(evaluation_profile, EvaluationProfileRecord)
        and evaluation_profile.workflow.nodes
    ):
        from app.run_evaluation.profile_workflow_runner import run_evaluation_profile_workflow

        return run_evaluation_profile_workflow(
            factor_id,
            evaluation_profile,
            data_set_id=merged_data_set_id,
        )

    err, ev, window, quantiles, _ = build_alphalens_evaluator_for_factor(
        factor_id, data_set_id=merged_data_set_id
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
