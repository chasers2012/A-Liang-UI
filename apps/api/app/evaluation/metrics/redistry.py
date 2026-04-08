from __future__ import annotations

from pathlib import Path

from custom_code import SourceFiles
from sqlmodel import select
from workspace import ensure_dir

from app.common.id import create_id_generator
from app.evaluation.metrics.constants import USER_METRIC_WORKFLOW_ROOT
from app.persistence.models import EvaluationMetricRow
from app.persistence.sqlite_db import get_session

from .schemas import EvaluationMetricRecord, EvaluationMetricsRegistryFile


def _row_to_record(row: EvaluationMetricRow) -> EvaluationMetricRecord:
    return EvaluationMetricRecord(
        id=row.id,
        name=row.name,
        description=row.description,
        source_path=row.source_path,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _record_to_row(rec: EvaluationMetricRecord) -> EvaluationMetricRow:
    return EvaluationMetricRow(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


class EvaluationMetricsRegistry:
    id_generator = create_id_generator("EvaluationMetricsRegistry")

    @classmethod
    def generate_id(cls, name: str | None = None) -> str:
        return cls.id_generator(name)

    @classmethod
    def list_items(cls) -> list[EvaluationMetricRecord]:
        with get_session() as session:
            rows = list(session.exec(select(EvaluationMetricRow)))
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, metric_id: str) -> EvaluationMetricRecord | None:
        with get_session() as session:
            row = session.get(EvaluationMetricRow, metric_id)
            return _row_to_record(row) if row is not None else None

    @classmethod
    def add_item(cls, item: EvaluationMetricRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(item))
            session.commit()

    @classmethod
    def update_item(cls, metric_id: str, fn) -> EvaluationMetricRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(EvaluationMetricRow, metric_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            fn(rec)
            session.merge(_record_to_row(rec))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, metric_id: str) -> EvaluationMetricRecord | None:
        with get_session() as session:
            row = session.get(EvaluationMetricRow, metric_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            session.delete(row)
            session.commit()
            return rec

    @classmethod
    def load(cls) -> EvaluationMetricsRegistryFile:
        return EvaluationMetricsRegistryFile(items=cls.list_items())

    @staticmethod
    def metrics_dir_path() -> Path:
        return ensure_dir(USER_METRIC_WORKFLOW_ROOT)

    @staticmethod
    def read_source(rec: EvaluationMetricRecord) -> str:
        return SourceFiles.read_source_text(rec.source_path)

    @classmethod
    def write_source(
        cls,
        rec: EvaluationMetricRecord,
        source: str,
        validators=None,
    ) -> None:
        cls.metrics_dir_path()
        SourceFiles.write_source_text(rec.source_path, source, validators=validators)

    @staticmethod
    def delete_source_file(rec: EvaluationMetricRecord) -> None:
        SourceFiles.delete_source_text_file(rec.source_path)
