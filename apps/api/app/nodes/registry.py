from __future__ import annotations

from pathlib import Path

from custom_code import SourceFiles
from sqlmodel import select
from workspace import ensure_dir

from app.common.id import create_id_generator
from app.nodes.constants import USER_NODE_WORKFLOW_ROOT
from app.nodes.schemas import WorkflowNodeRecord, WorkflowNodesRegistryFile
from app.persistence.models import WorkflowNodeRow
from app.persistence.sqlite_db import get_session


def _row_to_record(row: WorkflowNodeRow) -> WorkflowNodeRecord:
    return WorkflowNodeRecord(
        id=row.id,
        name=row.name,
        description=row.description,
        source_path=row.source_path,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _record_to_row(rec: WorkflowNodeRecord) -> WorkflowNodeRow:
    return WorkflowNodeRow(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


class WorkflowNodesRegistry:
    id_generator = create_id_generator("WorkflowNodesRegistry")

    @classmethod
    def generate_id(cls, name: str | None = None) -> str:
        return cls.id_generator(name)

    @classmethod
    def list_items(cls) -> list[WorkflowNodeRecord]:
        with get_session() as session:
            rows = list(session.exec(select(WorkflowNodeRow)))
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, node_id: str) -> WorkflowNodeRecord | None:
        with get_session() as session:
            row = session.get(WorkflowNodeRow, node_id)
            return _row_to_record(row) if row is not None else None

    @classmethod
    def add_item(cls, item: WorkflowNodeRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(item))
            session.commit()

    @classmethod
    def update_item(cls, node_id: str, fn) -> WorkflowNodeRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(EvaluationMetricRow, node_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            fn(rec)
            session.merge(_record_to_row(rec))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, node_id: str) -> WorkflowNodeRecord | None:
        with get_session() as session:
            row = session.get(EvaluationMetricRow, node_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            session.delete(row)
            session.commit()
            return rec

    @classmethod
    def load(cls) -> WorkflowNodesRegistryFile:
        return WorkflowNodesRegistryFile(items=cls.list_items())

    @staticmethod
    def nodes_dir_path() -> Path:
        return ensure_dir(USER_NODE_WORKFLOW_ROOT)

    @staticmethod
    def read_source(rec: WorkflowNodeRecord) -> str:
        return SourceFiles.read_source_text(rec.source_path)

    @classmethod
    def write_source(cls, rec: WorkflowNodeRecord, source: str, validators=None) -> None:
        cls.nodes_dir_path()
        SourceFiles.write_source_text(rec.source_path, source, validators=validators)

    @staticmethod
    def delete_source_file(rec: WorkflowNodeRecord) -> None:
        SourceFiles.delete_source_text_file(rec.source_path)
