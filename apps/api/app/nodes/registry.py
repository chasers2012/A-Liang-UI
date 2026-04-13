from __future__ import annotations

import inspect
from pathlib import Path
from typing import ClassVar

from custom_code import SourceFiles
from sqlmodel import select
from workflow import Node
from workflow.node_loader import WorkflowNodeLoader
from workspace import ensure_dir

from app.common.id import create_id_generator
from app.nodes.constants import (
    PLUGIN_NODE_SOURCE_SENTINEL,
    PLUGIN_NODE_TIMESTAMP_ISO,
    USER_NODE_WORKFLOW_ROOT,
)
from app.nodes.schemas import WorkflowNodesRegistryFile
from app.persistence.models import WorkflowNodeRow
from app.persistence.sqlite_db import get_session


class WorkflowNodesRegistry:
    id_generator = create_id_generator("WorkflowNodesRegistry")
    _plugin_nodes: ClassVar[dict[str, type[Node]]] = {}

    @classmethod
    def generate_id(cls, name: str | None = None) -> str:
        return cls.id_generator(name)

    @classmethod
    def register_plugin_node(cls, type_key: str, node_cls: type[Node]) -> None:
        tk = type_key.strip()
        if not tk:
            raise ValueError("plugin workflow node type_key must be non-empty")
        WorkflowNodeLoader.instance().register_node(tk, node_cls)
        cls._plugin_nodes[tk] = node_cls

    @classmethod
    def iter_registered_plugin_nodes(cls) -> list[tuple[str, type[Node]]]:
        return list(cls._plugin_nodes.items())

    @classmethod
    def get_plugin_node_class(cls, type_key: str) -> type[Node] | None:
        return cls._plugin_nodes.get(type_key)

    @classmethod
    def _plugin_node_record(cls, type_key: str) -> WorkflowNodeRow | None:
        node_cls = cls._plugin_nodes.get(type_key)
        if node_cls is None:
            return None
        return WorkflowNodeRow(
            id=type_key,
            name=getattr(node_cls, "label", type_key),
            description=getattr(node_cls, "description", "") or "",
            source_path=PLUGIN_NODE_SOURCE_SENTINEL,
            created_at=PLUGIN_NODE_TIMESTAMP_ISO,
            updated_at=PLUGIN_NODE_TIMESTAMP_ISO,
        )

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
        return cls._plugin_node_record(node_id)

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
        if rec.source_path == PLUGIN_NODE_SOURCE_SENTINEL:
            node_cls = WorkflowNodesRegistry.get_plugin_node_class(rec.id)
            if node_cls is None:
                return ""
            try:
                return inspect.getsource(node_cls)
            except (OSError, TypeError):
                return (
                    f"# 无法读取插件节点类 {node_cls.__module__}.{node_cls.__qualname__} 的源码"
                    "（可能为内置或动态定义）。\n"
                )
        return SourceFiles.read_source_text(rec.source_path)

    @classmethod
    def write_source(cls, rec: WorkflowNodeRow, source: str, validators=None) -> None:
        if rec.source_path == PLUGIN_NODE_SOURCE_SENTINEL:
            raise ValueError("cannot write source for plugin workflow node")
        cls.nodes_dir_path()
        SourceFiles.write_source_text(rec.source_path, source, validators=validators)

    @staticmethod
    def delete_source_file(rec: WorkflowNodeRow) -> None:
        if rec.source_path == PLUGIN_NODE_SOURCE_SENTINEL:
            return
        SourceFiles.delete_source_text_file(rec.source_path)
