from __future__ import annotations

from custom_code import validate_identifier_name, validate_source_syntax
from pydantic import BaseModel, ConfigDict, Field, field_validator
from workflow.node_loader import WorkflowNodeLoader


class WorkflowNodeRecord(BaseModel):
    model_config = ConfigDict(extra="ignore", arbitrary_types_allowed=True)

    id: str
    name: str
    description: str = ""
    source_path: str
    created_at: str
    updated_at: str


class WorkflowNodesRegistryFile(BaseModel):
    version: int = 1
    items: list[WorkflowNodeRecord] = Field(default_factory=list)


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

    def to_record(self, node_id: str, now: str, source_path: str) -> WorkflowNodeRecord:
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(self.source)
        return WorkflowNodeRecord(
            id=node_id,
            name=node_cls.label,
            description=node_cls.description,
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
    source_path: str
    created_at: str
    updated_at: str
    type: str
    category: str | None = None
    entry: str
    inputs: list[dict]
    outputs: list[dict]


class WorkflowNodeDetailPublic(WorkflowNodeSummaryPublic):
    source: str
