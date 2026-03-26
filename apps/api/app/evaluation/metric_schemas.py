from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

EVALUATION_METRICS_DIR = "evaluation_metrics"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def source_relative_path(metric_id: str) -> str:
    return f"{EVALUATION_METRICS_DIR}/{metric_id}.py"


def default_metric_source(name: str) -> str:
    safe = (name or "metric").strip() or "metric"
    return f'''from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric


class UserEvaluationMetric(EvaluationMetric[dict[str, float]]):
    """
    自定义评价指标：实现 evaluate，输入一般为 factor_data_clean (DataFrame)。
    端口元数据供工作流编辑器校验（类属性，可选）。
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


class EvaluationMetricRecord(BaseModel):
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
    name: str
    description: str = ""
    source: Optional[str] = None

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
        )


class EvaluationMetricPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None


class EvaluationMetricSummaryPublic(BaseModel):
    id: str
    name: str
    description: str
    source_path: str
    created_at: str
    updated_at: str


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
    )


def new_metric_id() -> str:
    return str(uuid4())
