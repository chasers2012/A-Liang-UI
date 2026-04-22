from __future__ import annotations

from app.data_set.controller import get_data_set
from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.profile.models import EvaluationProfileRow
from app.evaluation.run.models import EvaluationRunRow
from app.factors.registry import FactorItemsRegistry
from app.scheduler.controller import enqueue_oneoff_job
from app.scheduler.handlers import register_task_handler
from app.scheduler.schemas import SchedulerJobPublic

from .profile_workflow_runner import run_evaluation_profile_workflow
from .redistry import (
    EvaluationRunsStore,
    delete_evaluation_run_by_id,
    upsert_evaluation_run,
)
from .schemas import (
    EvaluationRunDetailPublic,
    EvaluationRunRowPublic,
)


class EvaluationRunNotFoundError(ValueError):
    def __init__(self, run_id: str) -> None:
        super().__init__(f"evaluation run 不存在: {run_id}")
        self.run_id = run_id


def execute_and_persist_evaluation_run(
    factor_id: str,
    evaluation_profile: EvaluationProfileRow,
    *,
    data_set_id: str | None = None,
) -> EvaluationRunRow:
    """Execute one evaluation run and append one run record (registry.json)."""
    eval_rec = run_evaluation_profile_workflow(
        factor_id,
        evaluation_profile,
        data_set_id=data_set_id,
    )
    upsert_evaluation_run(eval_rec)
    return eval_rec


def run_evaluation_run(
    profile_id: str,
    factor_id: str,
    *,
    data_set_id: str | None = None,
) -> EvaluationRunRowPublic:
    from app.evaluation.profile.redistry import EvaluationProfilesRegistry

    prof = EvaluationProfilesRegistry.get_by_id(profile_id)
    if prof is None:
        raise ProfileNotFoundError(profile_id)
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise FactorNotFoundError(factor_id)
    ds_override = (data_set_id or "").strip() or None
    if ds_override is not None and get_data_set(ds_override) is None:
        raise ValueError("数据集不存在")
    eval_rec = execute_and_persist_evaluation_run(
        factor_id,
        evaluation_profile=prof,
        data_set_id=ds_override,
    )
    err_raw = (eval_rec.error or "").strip()
    err: str | None = err_raw or None
    return EvaluationRunRowPublic(
        id=eval_rec.id,
        factor_id=factor_id,
        name=rec.name,
        has_evaluation=True,
        evaluated_at=eval_rec.end_at.isoformat(),
        error=err,
        evaluation_profile_id=eval_rec.evaluation_profile_id,
        results=eval_rec.results,
    )


def enqueue_evaluation_run(
    profile_id: str,
    factor_id: str,
    *,
    data_set_id: str | None = None,
) -> SchedulerJobPublic:
    from app.evaluation.profile.redistry import EvaluationProfilesRegistry

    prof = EvaluationProfilesRegistry.get_by_id(profile_id)
    if prof is None:
        raise ProfileNotFoundError(profile_id)
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise FactorNotFoundError(factor_id)
    ds_override = (data_set_id or "").strip() or None
    if ds_override is not None and get_data_set(ds_override) is None:
        raise ValueError("数据集不存在")
    dedupe_suffix = ds_override or "default"
    return enqueue_oneoff_job(
        task_type="evaluation.run",
        trigger_type="manual",
        payload={
            "profile_id": profile_id,
            "factor_id": factor_id,
            "data_set_id": ds_override,
        },
        max_retries=0,
        timeout_seconds=3600,
        dedupe_key=f"evaluation-run:{profile_id}:{factor_id}:{dedupe_suffix}",
    )


def _evaluation_run_handler(payload: dict[str, object]) -> dict[str, object]:
    profile_id = str(payload.get("profile_id", "")).strip()
    factor_id = str(payload.get("factor_id", "")).strip()
    if not profile_id:
        raise ValueError("evaluation.run 任务需要 profile_id")
    if not factor_id:
        raise ValueError("evaluation.run 任务需要 factor_id")
    data_set_raw = payload.get("data_set_id")
    data_set_id = None if data_set_raw is None else str(data_set_raw)
    row = run_evaluation_run(profile_id, factor_id, data_set_id=data_set_id)
    return row.model_dump(mode="json")


register_task_handler("evaluation.run", _evaluation_run_handler)


def _to_detail_public(run: EvaluationRunRow) -> EvaluationRunDetailPublic:
    factor_name = None
    factor_rec = FactorItemsRegistry.get_item(run.factor_id)
    if factor_rec is not None:
        factor_name = factor_rec.name
    return EvaluationRunDetailPublic(
        id=run.id,
        factor_id=run.factor_id,
        factor_name=factor_name,
        start_at=run.start_at,
        end_at=run.end_at,
        error=run.error,
        evaluation_profile_id=run.evaluation_profile_id,
        results=run.results,
    )


def list_evaluation_runs(
    factor_id: str | None = None,
    limit: int | None = None,
) -> list[EvaluationRunDetailPublic]:
    records = (
        EvaluationRunsStore.list_by_factor_id(factor_id)
        if factor_id
        else EvaluationRunsStore.list_items()
    )
    records = sorted(records, key=lambda rec: rec.end_at, reverse=True)
    if limit is not None and limit > 0:
        records = records[:limit]
    return [_to_detail_public(rec) for rec in records]


def get_evaluation_run_detail(run_id: str) -> EvaluationRunDetailPublic:
    rec = EvaluationRunsStore.get_item(run_id)
    if rec is None:
        raise EvaluationRunNotFoundError(run_id)
    return _to_detail_public(rec)


def delete_evaluation_run(run_id: str) -> None:
    ok = delete_evaluation_run_by_id(run_id)
    if not ok:
        raise EvaluationRunNotFoundError(run_id)


def delete_evaluation_runs_for_factor(factor_id: str) -> None:
    records = EvaluationRunsStore.list_by_factor_id(factor_id)
    for rec in records:
        delete_evaluation_run(rec.id)
