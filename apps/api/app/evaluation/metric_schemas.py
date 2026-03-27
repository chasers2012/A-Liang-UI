from __future__ import annotations

import re
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app import datetime_utils

EVALUATION_METRICS_DIR = "evaluation_metrics"

utc_now_iso = datetime_utils.utc_now_iso


def source_relative_path(metric_id: str) -> str:
    return f"{EVALUATION_METRICS_DIR}/{metric_id}.py"


def default_metric_source(name: str) -> str:
    label = (name or "metric").strip() or "metric"
    return f'''# metric: {label}
from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric


class UserEvaluationMetric(EvaluationMetric[dict[str, float]]):
    """
    自定义评价指标：实现 evaluate，输入一般为 factor_data_clean (DataFrame)。
    端口元数据供工作流编辑器校验（类属性，可选）。
    结果展示请在评价方案工作流中用「结果可视化」节点配置。
    """
    INPUT_SOCKETS = [
        {{"name": "clean_factor", "required": True, "value_type": "factor_data_clean"}},
    ]
    OUTPUT_SOCKETS = [
        {{"name": "out", "value_type": "scalar_json"}},
    ]

    def evaluate(self, clean_factor: pd.DataFrame, **kwargs: Any) -> dict[str, float]:
        _ = clean_factor
        return {{"demo": 0.0}}
'''


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
    type: Literal["number", "boolean", "enum"] = "number"
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


class EvaluationMetricRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    source_path: str
    created_at: str
    updated_at: str
    visualization: MetricVisualizationSpec | None = None
    builtin: bool = False
    workflow_parameters: list[MetricWorkflowParamSpec] = Field(default_factory=list)


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
        return EvaluationMetricRecord(
            id=metric_id,
            name=self.name.strip(),
            description=self.description.strip(),
            source_path=source_relative_path(metric_id),
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
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        visualization=None,
        builtin=rec.builtin,
        workflow_parameters=list(rec.workflow_parameters or []),
    )


def new_metric_id() -> str:
    return str(uuid4())
