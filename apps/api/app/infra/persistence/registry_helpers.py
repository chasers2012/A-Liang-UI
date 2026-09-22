from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol, TypeVar


class HasId(Protocol):
    id: str


class HasDefaultFlag(Protocol):
    id: str
    is_default: bool


T_id = TypeVar("T_id", bound=HasId)
T_default = TypeVar("T_default", bound=HasDefaultFlag)


def get_item_by_id(items: Sequence[T_id], item_id: str) -> T_id | None:
    for item in items:
        if item.id == item_id:
            return item
    return None


def apply_default_uniqueness(items: list[T_default]) -> None:
    default_ids = [i.id for i in items if i.is_default]
    if len(default_ids) <= 1:
        return
    keep = default_ids[-1]
    for i in items:
        if i.id != keep:
            i.is_default = False


def get_first_default_item(items: Sequence[T_default]) -> T_default | None:
    for i in items:
        if i.is_default:
            return i
    return None
