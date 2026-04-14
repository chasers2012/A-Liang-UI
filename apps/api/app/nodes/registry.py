from __future__ import annotations

import inspect
from pathlib import Path

from custom_code import SourceFiles
from sqlmodel import select
from workflow import Node
from workflow.node_loader import WorkflowNodeLoader
from workspace import ensure_dir

from app.nodes.constants import (
    PLUGIN_NODE_TIMESTAMP_ISO,
    USER_NODE_WORKFLOW_ROOT,
)
from app.nodes.schemas import WorkflowNodesRegistryFile
from app.persistence.models import WorkflowNodeRow
from app.persistence.sqlite_db import get_session


class WorkflowNodesRegistry:
    @classmethod
    def register_plugin_node(cls, type_key: str, node_cls: type[Node]) -> None:
        tk = type_key.strip()
        if not tk:
            raise ValueError("plugin workflow node type_key must be non-empty")
        WorkflowNodeLoader.instance().register_node(tk, node_cls)
        with get_session() as session:
            session.merge(
                WorkflowNodeRow(
                    id=tk,
                    name=getattr(node_cls, "label", tk),
                    description=getattr(node_cls, "description", "") or "",
                    is_plugin=True,
                    source_path="",
                    created_at=PLUGIN_NODE_TIMESTAMP_ISO,
                    updated_at=PLUGIN_NODE_TIMESTAMP_ISO,
                )
            )
            session.commit()

    @classmethod
    def resolve_node_class(cls, rec: WorkflowNodeRow) -> type[Node]:
        loader = WorkflowNodeLoader.instance()
        try:
            return loader.resolve(rec.id)
        except Exception:
            if rec.is_plugin:
                raise
            source = cls.read_source(rec)
            node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(source)
            loader.register_node(rec.id, node_cls)
            return loader.resolve(rec.id)

    @classmethod
    def list_items(cls) -> list[WorkflowNodeRow]:
        with get_session() as session:
            rows = list(session.exec(select(WorkflowNodeRow)))
        return [WorkflowNodeRow(**r.model_dump()) for r in rows]

    @classmethod
    def get_item(cls, node_id: str) -> WorkflowNodeRow | None:
        with get_session() as session:
            row = session.get(WorkflowNodeRow, node_id)
            if row is not None:
                return WorkflowNodeRow(**row.model_dump())
        return None

    @classmethod
    def add_item(cls, item: WorkflowNodeRow) -> None:
        with get_session() as session:
            session.add(WorkflowNodeRow(**item.model_dump()))
            session.commit()

    @classmethod
    def update_item(cls, node_id: str, fn) -> WorkflowNodeRow | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(WorkflowNodeRow, node_id)
            if row is None:
                return None
            rec = WorkflowNodeRow(**row.model_dump())
            fn(rec)
            session.merge(WorkflowNodeRow(**rec.model_dump()))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, node_id: str) -> WorkflowNodeRow | None:
        with get_session() as session:
            row = session.get(WorkflowNodeRow, node_id)
            if row is None:
                return None
            rec = WorkflowNodeRow(**row.model_dump())
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
    def read_source(rec: WorkflowNodeRow) -> str:
        if rec.is_plugin:
            try:
                return inspect.getsource(WorkflowNodesRegistry.resolve_node_class(rec))
            except (OSError, TypeError):
                return f"# 无法读取插件节点类 {rec.id} 的源码（可能为内置或动态定义）。\n"
        return SourceFiles.read_source_text(rec.source_path)

    @classmethod
    def write_source(cls, rec: WorkflowNodeRow, source: str, validators=None) -> None:
        if rec.is_plugin:
            raise ValueError("cannot write source for plugin workflow node")
        cls.nodes_dir_path()
        SourceFiles.write_source_text(rec.source_path, source, validators=validators)

    @staticmethod
    def delete_source_file(rec: WorkflowNodeRow) -> None:
        if rec.is_plugin:
            return
        SourceFiles.delete_source_text_file(rec.source_path)
