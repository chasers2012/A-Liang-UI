from __future__ import annotations

from custom_code import validate_identifier_name as validate_metric_name
from custom_code import validate_source_syntax
from pydantic import BaseModel, ConfigDict, Field, field_validator
from workflow.parser import Parser

from app.evaluation.metrics.metric_package_manager import EvaluationMetricPackageManager


class EvaluationMetricRecord(BaseModel):
    model_config = ConfigDict(extra="ignore", arbitrary_types_allowed=True)

    id: str
    name: str
    description: str = ""
    source_path: str
    created_at: str
    updated_at: str


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
        name, _, _, _ = Parser.parse_workflow_node_source(s)
        validate_metric_name(name)

        return s

    def to_record(
        self,
        metric_id: str,
        now: str,
        source_path: str,
    ) -> EvaluationMetricRecord:
        name, description, _, _ = Parser.parse_workflow_node_source(self.source)
        return EvaluationMetricRecord(
            id=metric_id,
            name=name,
            description=description,
            source_path=source_path,
            created_at=now,
            updated_at=now,
        )


class EvaluationMetricPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    source: str | None = None

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


class EvaluationMetricSummaryPublic(BaseModel):
    id: str
    name: str
    description: str
    source_path: str
    created_at: str
    updated_at: str
    inputs: list[dict]
    outputs: list[dict]


class EvaluationMetricDetailPublic(EvaluationMetricSummaryPublic):
    source: str


metric_source_validators = [
    validate_source_syntax,
    EvaluationMetricPackageManager.is_valid_evaluation_metric_class,
]
