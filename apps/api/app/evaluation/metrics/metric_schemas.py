from __future__ import annotations

import json
from typing import Any, Literal
from uuid import uuid4

from custom_code import validate_identifier_name as validate_metric_name
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from workflow import NodeParamModel

from app import datetime_utils
from app.evaluation.scheme.metric_workflow_parameters import (
    validate_metric_workflow_parameters,
)

USER_METRIC_WORKFLOW_ROOT = "workflow_nodes/evaluation"

utc_now_iso = datetime_utils.utc_now_iso


def user_metric_package_dir(metric_id: str) -> str:
    return f"em_{metric_id.replace('-', '_')}"


def user_metric_workflow_node_fqn(metric_id: str) -> str:
    """Class FQN for the user metric node (``em_<id>.metric_node.UserEvaluationMetric``)."""
    return f"{user_metric_package_dir(metric_id)}.metric_node.UserEvaluationMetric"


def user_metric_workflow_type_id(metric_id: str) -> str:
    """Alias for :func:`user_metric_workflow_node_fqn` (stored in ``workflow_type_id``)."""
    return user_metric_workflow_node_fqn(metric_id)


def user_metric_source_path(metric_id: str) -> str:
    return f"{USER_METRIC_WORKFLOW_ROOT}/{user_metric_package_dir(metric_id)}/metric_node.py"


def user_metric_init_path(metric_id: str) -> str:
    return f"{USER_METRIC_WORKFLOW_ROOT}/{user_metric_package_dir(metric_id)}/__init__.py"


def user_metric_package_parts(metric_id: str) -> tuple[str, str, str]:
    d = user_metric_package_dir(metric_id)
    return d, user_metric_init_path(metric_id), user_metric_source_path(metric_id)


def _metric_id_from_em_package_name(pkg: str) -> str | None:
    if not pkg.startswith("em_"):
        return None
    tail = pkg[3:]
    parts = tail.split("_")
    if len(parts) != 5:
        return None
    a, b, c, d, e = parts
    if len(a) != 8 or len(b) != 4 or len(c) != 4 or len(d) != 4 or len(e) != 12:
        return None
    return f"{a}-{b}-{c}-{d}-{e}"


def registry_metric_id_from_workflow_type(workflow_type_id: str) -> str | None:
    """Resolve registry metric id from ``em_<id>.metric_node.UserEvaluationMetric`` node type FQN."""
    w = (workflow_type_id or "").strip()
    if w.endswith(".UserEvaluationMetric"):
        parts = w.split(".")
        if len(parts) >= 3 and parts[-2] == "metric_node":
            return _metric_id_from_em_package_name(parts[-3])
    return None


def builtin_metric_id_from_workflow_node_fqn(workflow_type_id: str) -> str | None:
    """Map built-in metric node class FQN to registry metric id."""
    w = (workflow_type_id or "").strip()
    if w.endswith(".BuiltinMeanIcNode") and "metric_builtin_mean_ic" in w:
        return "builtin_mean_ic"
    if w.endswith(".BuiltinMeanReturnSpreadNode") and "metric_builtin_mean_return_spread" in w:
        return "builtin_mean_return_spread"
    return None


def default_metric_source(name: str, metric_id: str) -> str:
    label = (name or "metric").strip() or "metric"
    label_js = json.dumps(label, ensure_ascii=False)
    return f"""# User evaluation metric: {label}
from __future__ import annotations

from typing import Any

import pandas as pd
from app.evaluation.metrics.user_metric_workflow import RegistryUserEvaluationMetric
from workflow import workflow_node, workflow_socket

REGISTRY_METRIC_ID = "{metric_id}"


@workflow_node(
    label={label_js},
    description="",
    entry="evaluate",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
        workflow_socket("last_quantiles", required=True, value_type="scalar_json"),
    ],
    output_sockets=[
        workflow_socket("out", value_type="scalar_json"),
        workflow_socket("merged_mean_ic", required=False, value_type="scalar_json"),
        workflow_socket("merged_spread", required=False, value_type="scalar_json"),
    ],
)
class UserEvaluationMetric(RegistryUserEvaluationMetric):
    REGISTRY_METRIC_ID = REGISTRY_METRIC_ID

    def evaluate(self, clean_factor: pd.DataFrame, **kwargs: Any) -> dict[str, float]:
        _ = clean_factor
        return {{"demo": 0.0}}
"""


MetricVisualizationMode = Literal[
    "auto",
    "bars",
    "bars_diverging",
    "table",
    "json",
    "scalar",
]


class MetricVisualizationSpec(BaseModel):
    """How factor-detail UI renders this metric's structured output."""

    model_config = ConfigDict(extra="ignore")

    mode: MetricVisualizationMode = "auto"
    period_day_keys: bool = False


class EvaluationMetricRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    source_path: str
    workflow_type_id: str = ""
    created_at: str
    updated_at: str
    visualization: MetricVisualizationSpec | None = None
    builtin: bool = False
    workflow_parameters: list[NodeParamModel] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _fill_workflow_type_id(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if data.get("workflow_type_id"):
            return data
        mid = data.get("id")
        if isinstance(mid, str) and mid.strip():
            data["workflow_type_id"] = user_metric_workflow_type_id(mid.strip())
        return data

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
        wf = user_metric_workflow_type_id(metric_id)
        return EvaluationMetricRecord(
            id=metric_id,
            name=self.name.strip(),
            description=self.description.strip(),
            source_path=user_metric_source_path(metric_id),
            workflow_type_id=wf,
            created_at=now,
            updated_at=now,
            visualization=None,
            builtin=False,
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
    workflow_type_id: str
    created_at: str
    updated_at: str
    visualization: MetricVisualizationSpec | None = None
    builtin: bool = False
    workflow_parameters: list[NodeParamModel] = Field(default_factory=list)


class EvaluationMetricDetailPublic(EvaluationMetricSummaryPublic):
    source: str


def record_to_summary(
    rec: EvaluationMetricRecord,
) -> EvaluationMetricSummaryPublic:
    data = rec.model_dump()
    data["workflow_type_id"] = data["workflow_type_id"] or user_metric_workflow_type_id(rec.id)
    data["visualization"] = None
    return EvaluationMetricSummaryPublic.model_validate(data)


def new_metric_id() -> str:
    return str(uuid4())
