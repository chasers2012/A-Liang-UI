from __future__ import annotations

from uuid import uuid4

from custom_code import validate_identifier_name as validate_metric_name
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from workflow import NodeParamModel

from app.evaluation.metrics.metric_package_manager import EvaluationMetricPackageManager
from app.evaluation.scheme.metric_workflow_parameters import (
    validate_metric_workflow_parameters,
)


class EvaluationMetricRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    source_path: str
    created_at: str
    updated_at: str
    workflow_parameters: list[NodeParamModel] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_workflow_parameters(self) -> EvaluationMetricRecord:
        validate_metric_workflow_parameters(list(self.workflow_parameters))
        return self


class EvaluationMetricsRegistryFile(BaseModel):
    version: int = 1
    items: list[EvaluationMetricRecord] = Field(default_factory=list)


class EvaluationMetricCreate(BaseModel):
    name: str
    description: str = ""
    source: str | None = None
    workflow_parameters: list[NodeParamModel] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        validate_metric_name(s)
        return s

    @model_validator(mode="after")
    def _wp_unique(self) -> EvaluationMetricCreate:
        validate_metric_workflow_parameters(list(self.workflow_parameters))
        return self

    def to_record(self, metric_id: str, now: str) -> EvaluationMetricRecord:
        return EvaluationMetricRecord(
            id=metric_id,
            name=self.name.strip(),
            description=self.description.strip(),
            source_path=EvaluationMetricPackageManager.get_source_path(metric_id),
            created_at=now,
            updated_at=now,
            workflow_parameters=list(self.workflow_parameters),
        )


class EvaluationMetricPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    source: str | None = None
    workflow_parameters: list[NodeParamModel] | None = None

    @field_validator("name")
    @classmethod
    def _name_when_set(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("name 不能为空")
        validate_metric_name(s)
        return s

    @model_validator(mode="after")
    def _wp_unique(self) -> EvaluationMetricPatch:
        if self.workflow_parameters is not None:
            validate_metric_workflow_parameters(list(self.workflow_parameters))
        return self


class EvaluationMetricSummaryPublic(BaseModel):
    id: str
    name: str
    description: str
    source_path: str
    created_at: str
    updated_at: str
    workflow_parameters: list[NodeParamModel] = Field(default_factory=list)


class EvaluationMetricDetailPublic(EvaluationMetricSummaryPublic):
    source: str


def record_to_summary(
    rec: EvaluationMetricRecord,
) -> EvaluationMetricSummaryPublic:
    data = rec.model_dump()
    return EvaluationMetricSummaryPublic.model_validate(data)


def new_metric_id() -> str:
    return str(uuid4())
