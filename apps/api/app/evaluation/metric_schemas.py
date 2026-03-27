from __future__ import annotations

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app import datetime_utils

EVALUATION_METRICS_DIR = "evaluation_metrics"

utc_now_iso = datetime_utils.utc_now_iso

BUILTIN_METRIC_SOURCE_PLACEHOLDER = "# 内置指标，源码在 evaluate 包中，仅作只读占位。\n"


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
    创建时若未在界面指定可视化，会尝试读取 VISUALIZATION 作为默认。
    """
    INPUT_SOCKETS = [
        {{"name": "clean_factor", "required": True, "value_type": "factor_data_clean"}},
    ]
    OUTPUT_SOCKETS = [
        {{"name": "out", "value_type": "scalar_json"}},
    ]
    VISUALIZATION = {{"mode": "auto", "period_day_keys": False}}

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


class EvaluationMetricRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    source_path: str
    created_at: str
    updated_at: str
    visualization: MetricVisualizationSpec | None = None


class EvaluationMetricsRegistryFile(BaseModel):
    version: int = 1
    items: list[EvaluationMetricRecord] = Field(default_factory=list)


class EvaluationMetricCreate(BaseModel):
    name: str
    description: str = ""
    source: str | None = None
    visualization: MetricVisualizationSpec | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    def to_record(self, metric_id: str, now: str) -> EvaluationMetricRecord:
        return EvaluationMetricRecord(
            id=metric_id,
            name=self.name.strip(),
            description=self.description.strip(),
            source_path=source_relative_path(metric_id),
            created_at=now,
            updated_at=now,
            visualization=self.visualization,
        )


class EvaluationMetricPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    source: str | None = None
    visualization: MetricVisualizationSpec | None = None


class EvaluationMetricSummaryPublic(BaseModel):
    id: str
    name: str
    description: str
    source_path: str
    created_at: str
    updated_at: str
    visualization: MetricVisualizationSpec | None = None
    builtin: bool = False


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
        visualization=rec.visualization,
        builtin=False,
    )


def new_metric_id() -> str:
    return str(uuid4())
