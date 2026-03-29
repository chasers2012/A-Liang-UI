"""Workspace ``config/*.json`` persistence: generic file store and item-list registries."""

from __future__ import annotations

from abc import ABC
from collections.abc import Callable
from pathlib import Path
from typing import Any, ClassVar, Generic, TypeVar

from pydantic import BaseModel

from app.persistence.registry_helpers import HasId, get_item_by_id
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

TFile = TypeVar("TFile", bound=BaseModel)
TItem = TypeVar("TItem", bound=HasId)


class WorkspaceJsonStore(ABC, Generic[TFile]):
    """Load/save one JSON document under ``config/`` via a Pydantic root model."""

    filename: ClassVar[str]
    file_model: ClassVar[type[TFile]]

    @classmethod
    def load_filename(cls) -> str:
        """Basename used when reading (may differ from ``filename`` for legacy migration)."""
        return cls.filename

    @classmethod
    def load_workspace_kwargs(cls) -> dict[str, Any]:
        """Extra keyword arguments passed to :func:`load_workspace_config`."""
        return {}

    @classmethod
    def save_model_dump_kwargs(cls) -> dict[str, Any] | None:
        """If set, passed as ``model_dump_kwargs`` to :func:`save_workspace_config`."""
        return None

    @classmethod
    def path(cls) -> Path:
        return workspace_config_path(cls.filename)

    @classmethod
    def load(cls) -> TFile:
        m = cls.file_model
        kwargs = cls.load_workspace_kwargs()
        return load_workspace_config(
            cls.load_filename(),
            m,
            default_factory=m,
            **kwargs,
        )

    @classmethod
    def save(cls, reg: TFile) -> None:
        md = cls.save_model_dump_kwargs()
        if md:
            save_workspace_config(cls.filename, reg, model_dump_kwargs=md)
        else:
            save_workspace_config(cls.filename, reg)


class WorkspaceItemsRegistry(WorkspaceJsonStore[TFile], Generic[TItem, TFile]):
    """JSON registry whose root model exposes an ``items`` sequence of id'd records.

    CRUD helpers load/save the registry file; use :meth:`get_by_id` when you already
    hold the root model (e.g. batch work on one loaded snapshot).
    """

    @classmethod
    def get_by_id(cls, reg: TFile, item_id: str) -> TItem | None:
        return get_item_by_id(reg.items, item_id)  # type: ignore[attr-defined]

    @classmethod
    def list_items(cls) -> list[TItem]:
        return list(cls.load().items)  # type: ignore[attr-defined]

    @classmethod
    def get_item(cls, item_id: str) -> TItem | None:
        return cls.get_by_id(cls.load(), item_id)

    @classmethod
    def add_item(cls, item: TItem) -> None:
        reg = cls.load()
        reg.items.append(item)  # type: ignore[attr-defined]
        cls.save(reg)

    @classmethod
    def update_item(
        cls,
        item_id: str,
        fn: Callable[[TItem], None],
        *,
        after_mutate: Callable[[TFile], None] | None = None,
    ) -> TItem | None:
        reg = cls.load()
        rec = cls.get_by_id(reg, item_id)
        if rec is None:
            return None
        fn(rec)
        if after_mutate is not None:
            after_mutate(reg)
        cls.save(reg)
        return rec

    @classmethod
    def delete_item(cls, item_id: str) -> TItem | None:
        reg = cls.load()
        rec = cls.get_by_id(reg, item_id)
        if rec is None:
            return None
        reg.items = [i for i in reg.items if i.id != item_id]  # type: ignore[attr-defined]
        cls.save(reg)
        return rec
