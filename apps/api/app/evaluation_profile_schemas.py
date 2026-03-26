from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from app.datasource_schemas import utc_now_iso


class WorkflowViewport(BaseModel):
    x: float = 0.0
    y: float = 0.0
    zoom: float = 1.0


class WorkflowNode(BaseModel):
    id: str
    type: str
    pos: list[float] = Field(default_factory=lambda: [0.0, 0.0])
    params: dict[str, Any] = Field(default_factory=dict)

    @field_validator("pos")
    @classmethod
    def _two_floats(cls, v: list[float]) -> list[float]:
        if len(v) != 2:
            raise ValueError("pos 须为 [x, y]")
        return [float(v[0]), float(v[1])]


class WorkflowLink(BaseModel):
    id: Optional[str] = None
    from_node: str
    from_socket: str
    to_node: str
    to_socket: str


class EvaluationWorkflow(BaseModel):
    nodes: list[WorkflowNode] = Field(default_factory=list)
    links: list[WorkflowLink] = Field(default_factory=list)
    viewport: Optional[WorkflowViewport] = None


class EvaluationProfilePrepare(BaseModel):
    """当 workflow 为空时，与现有 runner 对齐的可选覆盖。"""

    forward_return_periods: list[int] = Field(default_factory=lambda: [1, 5, 10, 20])
    quantiles: Optional[int] = None
    long_short: bool = True
    max_loss: float = 0.5


class EvaluationProfileRecord(BaseModel):
    id: str
    name: str
    description: str = ""
    test_set_id: Optional[str] = None
    prepare: EvaluationProfilePrepare = Field(default_factory=EvaluationProfilePrepare)
    workflow: EvaluationWorkflow = Field(default_factory=EvaluationWorkflow)
    is_default: bool = False
    created_at: str
    updated_at: str


class EvaluationProfilesFile(BaseModel):
    version: int = 1
    items: list[EvaluationProfileRecord] = Field(default_factory=list)


class EvaluationProfileCreate(BaseModel):
    name: str
    description: str = ""
    test_set_id: Optional[str] = None
    prepare: Optional[EvaluationProfilePrepare] = None
    workflow: Optional[EvaluationWorkflow] = None
    is_default: bool = False

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    def to_record(self) -> EvaluationProfileRecord:
        now = utc_now_iso()
        rid = str(uuid4())
        prep = self.prepare or EvaluationProfilePrepare()
        wf = self.workflow or EvaluationWorkflow()
        return EvaluationProfileRecord(
            id=rid,
            name=self.name.strip(),
            description=self.description.strip(),
            test_set_id=(self.test_set_id or "").strip() or None,
            prepare=prep,
            workflow=wf,
            is_default=self.is_default,
            created_at=now,
            updated_at=now,
        )


class EvaluationProfilePatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    test_set_id: Optional[str] = None
    prepare: Optional[EvaluationProfilePrepare] = None
    workflow: Optional[EvaluationWorkflow] = None
    is_default: Optional[bool] = None


class EvaluationProfilePublic(BaseModel):
    id: str
    name: str
    description: str
    test_set_id: Optional[str] = None
    prepare: EvaluationProfilePrepare
    workflow: EvaluationWorkflow
    is_default: bool
    created_at: str
    updated_at: str


class NodeTypeSocketPublic(BaseModel):
    name: str
    required: bool = False
    value_type: str


class NodeTypeDefinitionPublic(BaseModel):
    type: str
    label: str
    description: str = ""
    inputs: list[NodeTypeSocketPublic] = Field(default_factory=list)
    outputs: list[NodeTypeSocketPublic] = Field(default_factory=list)
    user_defined: bool = False
    metric_id: Optional[str] = None
