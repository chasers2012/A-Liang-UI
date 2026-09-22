from __future__ import annotations

from pydantic import BaseModel, Field


class SubagentToolPublic(BaseModel):
    id: str
    name: str
    description: str
    category: str
    loaded: bool


class SubagentToolConfigPublic(BaseModel):
    subagent_id: str
    title: str
    description: str
    default_tool_ids: list[str] = Field(default_factory=list)
    tool_ids: list[str] = Field(default_factory=list)


class SubagentToolConfigListPublic(BaseModel):
    subagents: list[SubagentToolConfigPublic] = Field(default_factory=list)
    tools: list[SubagentToolPublic] = Field(default_factory=list)


class SubagentToolConfigUpdateBody(BaseModel):
    tool_ids: list[str] = Field(default_factory=list)
