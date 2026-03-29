from __future__ import annotations

import json
import re
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app import datetime_utils

EVALUATION_METRICS_DIR = "evaluation/metrics/source"
USER_METRIC_WORKFLOW_ROOT = "workflow_nodes/evaluation"

utc_now_iso = datetime_utils.utc_now_iso


def user_metric_package_dir(metric_id: str) -> str:
    return f"em_{metric_id.replace('-', '_')}"


def user_metric_workflow_type_id(metric_id: str) -> str:
    return f"user_metric_{metric_id.replace('-', '_')}"


def user_metric_source_path(metric_id: str) -> str:
    return f"{USER_METRIC_WORKFLOW_ROOT}/{user_metric_package_dir(metric_id)}/metric_node.py"


def user_metric_init_path(metric_id: str) -> str:
    return f"{USER_METRIC_WORKFLOW_ROOT}/{user_metric_package_dir(metric_id)}/__init__.py"


def user_metric_package_parts(metric_id: str) -> tuple[str, str, str]:
    d = user_metric_package_dir(metric_id)
    return d, user_metric_init_path(metric_id), user_metric_source_path(metric_id)


def registry_metric_id_from_workflow_type(workflow_type_id: str) -> str | None:
    prefix = "user_metric_"
    if not workflow_type_id.startswith(prefix):
        return None
    tail = workflow_type_id[len(prefix) :]
    parts = tail.split("_")
    if len(parts) != 5:
        return None
    a, b, c, d, e = parts
    if len(a) != 8 or len(b) != 4 or len(c) != 4 or len(d) != 4 or len(e) != 12:
        return None
    return f"{a}-{b}-{c}-{d}-{e}"


def source_relative_path(metric_id: str) -> str:
    """Deprecated layout; use :func:`user_metric_source_path`."""
    return user_metric_source_path(metric_id)


def default_metric_source(name: str, metric_id: str) -> str:
    label = (name or "metric").strip() or "metric"
    wf_tid = user_metric_workflow_type_id(metric_id)
    label_js = json.dumps(label, ensure_ascii=False)
    return f"""# User evaluation metric: {label}
from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from app.evaluation.metrics.user_metric_workflow import run_registry_evaluation_metric
from workflow import WorkflowNode, workflow_node, workflow_socket

REGISTRY_METRIC_ID = "{metric_id}"


class UserEvaluationMetric(EvaluationMetric[dict[str, float]]):
    \"\"\"
    自定义评价指标：实现 evaluate，输入一般为 factor_data_clean (DataFrame)。
    端口元数据供工作流编辑器校验（类属性，可选）。
    \"\"\"
    INPUT_SOCKETS = [
        {{"name": "clean_factor", "required": True, "value_type": "factor_data_clean"}},
    ]
    OUTPUT_SOCKETS = [
        {{"name": "out", "value_type": "scalar_json"}},
    ]

    def evaluate(self, clean_factor: pd.DataFrame, **kwargs: Any) -> dict[str, float]:
        _ = clean_factor
        return {{"demo": 0.0}}


@workflow_node(
    type_id="{wf_tid}",
    label={label_js},
    description="",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
)
class UserMetricWorkflowNode:
    def execute(self, node: WorkflowNode, inputs, ctx):
        return run_registry_evaluation_metric(REGISTRY_METRIC_ID, node, inputs, ctx)
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


_PARAM_KEY_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
RESERVED_METRIC_WORKFLOW_PARAM_KEYS = frozenset({"quantiles", "clean_factor"})


class MetricWorkflowParamSpec(BaseModel):
    """Declarative kwargs for ``evaluate(..., **kwargs)`` (besides ``clean_factor``)."""

    model_config = ConfigDict(extra="ignore")

    key: str
    label: str = ""
    type: Literal["number", "boolean", "enum", "string"] = "number"
    default: Any | None = None
    minimum: float | int | None = None
    maximum: float | int | None = None
    enum_values: list[str] = Field(default_factory=list)

    @field_validator("key")
    @classmethod
    def _key_ok(cls, v: str) -> str:
        s = str(v).strip()
        if not s or not _PARAM_KEY_RE.match(s):
            raise ValueError("参数 key 须为合法 Python 标识符")
        if s in RESERVED_METRIC_WORKFLOW_PARAM_KEYS:
            raise ValueError(f"参数 key {s!r} 为运行期保留，不可使用")
        return s

    @field_validator("label")
    @classmethod
    def _label_strip(cls, v: str) -> str:
        return str(v).strip()

    @field_validator("enum_values", mode="before")
    @classmethod
    def _enum_strip(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("enum_values 须为字符串数组")
        out: list[str] = []
        for x in v:
            s = str(x).strip()
            if s:
                out.append(s)
        return out

    @model_validator(mode="after")
    def _type_rules(self) -> MetricWorkflowParamSpec:
        if self.type == "enum":
            if not self.enum_values:
                raise ValueError(f"枚举参数 {self.key!r} 须设置非空 enum_values")
            if self.default is not None and str(self.default) not in self.enum_values:
                raise ValueError(
                    f"参数 {self.key!r} 的 default 须在 enum_values 内",
                )
        return self


def validate_workflow_parameters_list(items: list[MetricWorkflowParamSpec]) -> None:
    keys = [x.key for x in items]
    if len(keys) != len(set(keys)):
        raise ValueError("workflow_parameters 存在重复的 key")


RESULT_VIZ_NODE_WORKFLOW_PARAMETERS: list[MetricWorkflowParamSpec] = [
    MetricWorkflowParamSpec(
        key="period_day_keys",
        label="周期键显示为「N 日」",
        type="boolean",
        default=False,
    ),
]

PREPARE_ALPHALENS_WORKFLOW_PARAMETERS: list[MetricWorkflowParamSpec] = [
    MetricWorkflowParamSpec(
        key="forward_return_periods",
        label="持有期 periods（逗号分隔）",
        type="string",
        default="1,5,10,20",
    ),
    MetricWorkflowParamSpec(
        key="alphalens_quantiles",
        label="分位数（留空则用环境变量 FACTOR_AGENT_QUANTILES，默认 5）",
        type="string",
        default="",
    ),
    MetricWorkflowParamSpec(
        key="long_short",
        label="多空 long_short",
        type="boolean",
        default=True,
    ),
    MetricWorkflowParamSpec(
        key="max_loss",
        label="max_loss",
        type="number",
        default=0.5,
        minimum=0.0,
        maximum=10.0,
    ),
]


def static_workflow_parameters_for_profile_node(
    workflow_type_id: str,
) -> list[MetricWorkflowParamSpec] | None:
    """Return fixed parameter specs when not loaded from the metrics registry.

    ``None`` means the caller should resolve ``workflow_parameters`` (and related
    fields) via :func:`registry_metric_id_from_workflow_type` and the registry.
    """
    tid = (workflow_type_id or "").strip()
    if tid == "prepare_alphalens":
        return PREPARE_ALPHALENS_WORKFLOW_PARAMETERS
    if tid.startswith("viz_"):
        return RESULT_VIZ_NODE_WORKFLOW_PARAMETERS
    return None


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
    workflow_parameters: list[MetricWorkflowParamSpec] = Field(default_factory=list)

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


class EvaluationMetricsRegistryFile(BaseModel):
    version: int = 1
    items: list[EvaluationMetricRecord] = Field(default_factory=list)


class EvaluationMetricCreate(BaseModel):
    name: str
    description: str = ""
    source: str | None = None
    workflow_parameters: list[MetricWorkflowParamSpec] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    @model_validator(mode="after")
    def _wp_unique(self) -> EvaluationMetricCreate:
        validate_workflow_parameters_list(list(self.workflow_parameters))
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
    workflow_parameters: list[MetricWorkflowParamSpec] | None = None

    @model_validator(mode="after")
    def _wp_unique(self) -> EvaluationMetricPatch:
        if self.workflow_parameters is not None:
            validate_workflow_parameters_list(list(self.workflow_parameters))
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
    workflow_parameters: list[MetricWorkflowParamSpec] = Field(default_factory=list)


class EvaluationMetricDetailPublic(EvaluationMetricSummaryPublic):
    source: str


def record_to_summary(rec: EvaluationMetricRecord) -> EvaluationMetricSummaryPublic:
    return EvaluationMetricSummaryPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        workflow_type_id=rec.workflow_type_id or user_metric_workflow_type_id(rec.id),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        visualization=None,
        builtin=rec.builtin,
        workflow_parameters=list(rec.workflow_parameters or []),
    )


def new_metric_id() -> str:
    return str(uuid4())
