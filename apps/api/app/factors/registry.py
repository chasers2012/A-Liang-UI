from __future__ import annotations

from app.factors.schemas import (
    FactorCreate,
    FactorDetailPublic,
    FactorPatch,
    FactorRecord,
    FactorRegistryFile,
    FactorSummaryPublic,
)
from app.persistence.workspace_registry import WorkspaceItemsRegistry

FACTORS_REGISTRY_FILENAME = "factors/registry.json"


class FactorItemsRegistry(WorkspaceItemsRegistry[FactorRecord, FactorRegistryFile]):
    filename = FACTORS_REGISTRY_FILENAME
    file_model = FactorRegistryFile

    @classmethod
    def create_factor(cls, body: FactorCreate) -> FactorRecord:
        from app.factors.controller import create_factor as create_factor_controller

        return create_factor_controller(body)

    @classmethod
    def update_factor(cls, factor_id: str, body: FactorPatch) -> FactorRecord:
        from app.factors.controller import update_factor as update_factor_controller

        return update_factor_controller(factor_id, body)

    @classmethod
    def get_factor(cls, factor_id: str):
        from app.factors.controller import get_factor as get_factor_controller

        return get_factor_controller(factor_id)


def factor_detail(rec: FactorRecord) -> FactorDetailPublic:
    from app.factors.controller import factor_detail as factor_detail_controller

    return factor_detail_controller(rec)


def read_source(rec: FactorRecord) -> str:
    from app.factors.controller import read_factor_source

    return read_factor_source(rec)


def delete_source_file(rec: FactorRecord) -> None:
    from app.factors.controller import delete_factor_source_file

    delete_factor_source_file(rec)


def list_factors() -> list[FactorSummaryPublic]:
    from app.factors.controller import list_factors as list_factors_controller

    return list_factors_controller()
