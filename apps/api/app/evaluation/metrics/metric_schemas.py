from __future__ import annotations

from custom_code import validate_identifier_name as validate_metric_name
from custom_code import validate_source_syntax
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from workflow import NodeParamModel, Socket
from workflow.parse import parse_workflow_node_source

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
    inputs: list[Socket] = Field(default_factory=list)
    outputs: list[Socket] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_workflow_parameters(self) -> EvaluationMetricRecord:
        validate_metric_workflow_parameters(list(self.workflow_parameters))
        return self


class EvaluationMetricsRegistryFile(BaseModel):
    version: int = 1
    items: list[EvaluationMetricRecord] = Field(default_factory=list)


class EvaluationMetricCreate(BaseModel):
    source: str | None = None

    @field_validator("source")
    @classmethod
    def _strip_source(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("source 不能为空")
        validate_source_syntax(s)
        name, _, workflow_parameters, _ = parse_workflow_node_source(s)
        validate_metric_name(name)
        validate_metric_workflow_parameters(workflow_parameters)

        return s

    def to_record(
        self,
        metric_id: str,
        now: str,
        source_path: str,
    ) -> EvaluationMetricRecord:
        name, description, workflow_parameters, _ = parse_workflow_node_source(self.source)
        return EvaluationMetricRecord(
            id=metric_id,
            name=name,
            description=description,
            source_path=source_path,
            created_at=now,
            updated_at=now,
            workflow_parameters=workflow_parameters,
            inputs=[],
            outputs=[],
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
    inputs: list[Socket] = Field(default_factory=list)
    outputs: list[Socket] = Field(default_factory=list)


class EvaluationMetricDetailPublic(EvaluationMetricSummaryPublic):
    source: str


def record_to_summary(
    rec: EvaluationMetricRecord,
) -> EvaluationMetricSummaryPublic:
    data = rec.model_dump()
    return EvaluationMetricSummaryPublic.model_validate(data)


metric_source_validators = [
    validate_source_syntax,
    EvaluationMetricPackageManager.is_valid_evaluation_metric_class,
]
