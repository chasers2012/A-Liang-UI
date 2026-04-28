from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator
from workflow.schemas import WorkflowGraphPersisted

from app.datasource.schemas import utc_now_iso
from app.strategy.constants import empty_workflow_template_dict
from app.strategy.models import StrategyRow


def workflow_public_dict(workflow_json: str) -> dict[str, Any]:
    raw = (workflow_json or "").strip()
    if not raw:
        return empty_workflow_template_dict()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("workflow 须为 JSON 对象")
    return WorkflowGraphPersisted.model_validate(data).model_dump(by_alias=True)


class StrategyCreate(BaseModel):
    name: str
    description: str = ""
    workflow: WorkflowGraphPersisted | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    def to_row(self) -> StrategyRow:
        now = utc_now_iso()
        rid = str(uuid4())
        wf = (
            self.workflow.model_dump(by_alias=True)
            if self.workflow is not None
            else empty_workflow_template_dict()
        )
        return StrategyRow(
            id=rid,
            name=self.name.strip(),
            description=self.description.strip(),
            workflow=json.dumps(wf, ensure_ascii=False),
            created_at=now,
            updated_at=now,
        )


class StrategyPatch(BaseModel):
    name: str | None = Field(default=None, description="策略名称（可选更新）")
    description: str | None = Field(default=None, description="策略描述（可选更新）")
    workflow: WorkflowGraphPersisted | None = Field(
        default=None, description="策略工作流图（可选更新）"
    )


class StrategyPublic(BaseModel):
    id: str = Field(description="策略唯一 ID")
    name: str = Field(description="策略名称")
    description: str = Field(description="策略描述")
    workflow: WorkflowGraphPersisted = Field(description="策略工作流图")
    created_at: str = Field(description="创建时间（ISO 8601）")
    updated_at: str = Field(description="更新时间（ISO 8601）")


class StrategyListPublic(BaseModel):
    id: str = Field(description="策略唯一 ID")
    name: str = Field(description="策略名称")
    description: str = Field(description="策略描述")
    created_at: str = Field(description="创建时间（ISO 8601）")
    updated_at: str = Field(description="更新时间（ISO 8601）")


class WorkflowIOSpecPublic(BaseModel):
    workflow_inputs: list[dict] = Field(description="工作流输入参数定义列表")
    workflow_outputs: list[dict] = Field(description="工作流输出参数定义列表")


class StrategyValidateResponse(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
