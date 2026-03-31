from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

WorkflowNodePackageKind = Literal["builtin", "user"]


class WorkflowNodePackageRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    domain: str
    package_name: str
    kind: WorkflowNodePackageKind = "user"
    enabled: bool = True


class WorkflowNodePackagesRegistryFile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    version: int = 1
    items: list[WorkflowNodePackageRecord] = Field(default_factory=list)
