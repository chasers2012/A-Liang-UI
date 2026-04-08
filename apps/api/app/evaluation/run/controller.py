from __future__ import annotations

from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.profile.schemas import EvaluationProfileRecord
from app.factors.registry import FactorItemsRegistry

from .profile_workflow_runner import run_evaluation_profile_workflow
from .redistry import (
    EvaluationRunsStore,
    delete_evaluation_run_by_id,
    upsert_evaluation_run,
)
from .schemas import (
    EvaluationRunDetailPublic,
    EvaluationRunRecord,
    EvaluationRunRowPublic,
)


class EvaluationRunNotFoundError(ValueError):
    def __init__(self, run_id: str) -> None:
        super().__init__(f"evaluation run 不存在: {run_id}")
        self.run_id = run_id


def execute_and_persist_evaluation_run(
    factor_id: str,
    evaluation_profile: EvaluationProfileRecord,
) -> EvaluationRunRecord:
    """Execute one evaluation run and append one run record (registry.json)."""
    eval_rec = run_evaluation_profile_workflow(
        factor_id,
        evaluation_profile,
    )
    upsert_evaluation_run(eval_rec)
    return eval_rec


def run_evaluation_run(profile_id: str, factor_id: str) -> EvaluationRunRowPublic:
    from app.evaluation.profile.redistry import EvaluationProfilesRegistry

    prof = EvaluationProfilesRegistry.get_by_id(profile_id)
    if prof is None:
        raise ProfileNotFoundError(profile_id)
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise FactorNotFoundError(factor_id)
    eval_rec = execute_and_persist_evaluation_run(
        factor_id,
        evaluation_profile=prof,
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


def _to_detail_public(run: EvaluationRunRecord) -> EvaluationRunDetailPublic:
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
