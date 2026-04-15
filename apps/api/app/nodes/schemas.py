from __future__ import annotations

from custom_code import validate_identifier_name, validate_source_syntax
from pydantic import BaseModel, Field, field_validator
from workflow.node_loader import WorkflowNodeLoader

from app.nodes.models import WorkflowNodeRow


class WorkflowNodeCreate(BaseModel):
    source: str

    @field_validator("source")
    @classmethod
    def _validate_source(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("source 不能为空")
        validate_source_syntax(s)
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(s)
        validate_identifier_name(node_cls.label)
        return s

    def to_record(self, node_id: str, now: str, source_path: str) -> WorkflowNodeRow:
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(self.source)
        return WorkflowNodeRow(
            id=node_id,
            name=node_cls.label,
            description=node_cls.description,
            is_plugin=False,
            source_path=source_path,
            created_at=now,
            updated_at=now,
        )


class WorkflowNodePatch(BaseModel):
    source: str | None = None

    @field_validator("source")
    @classmethod
    def _source_when_set(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("source 不能为空")
        validate_source_syntax(s)
        WorkflowNodeLoader.load_workflow_node_class_from_source(s)
        return s


class WorkflowNodeSummaryPublic(BaseModel):
    id: str
    name: str
    description: str
    is_plugin: bool = False
    created_at: str
    updated_at: str
    category: str | None = None
    inputs: list[dict]
    outputs: list[dict]


class WorkflowNodeDetailPublic(WorkflowNodeSummaryPublic):
    source: str


class WorkflowDomainNodeVisibilityPatch(BaseModel):
    domain: str
    hidden_node_ids: list[str] = Field(default_factory=list)

    @field_validator("domain")
    @classmethod
    def _validate_domain(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("domain 不能为空")
        return value

    @field_validator("hidden_node_ids")
    @classmethod
    def _validate_hidden_node_ids(cls, v: list[str]) -> list[str]:
        return [item.strip() for item in v if item and item.strip()]


class WorkflowDomainNodeVisibilityPublic(BaseModel):
    domain: str
    hidden_node_ids: list[str]


class WorkflowDomainNodeValidationPublic(BaseModel):
    domain: str
    node_id: str
    allowed: bool
