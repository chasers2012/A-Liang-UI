from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.datetime_utils import utc_now_iso
from app.evaluation.metrics.constants import DEFAULT_METRIC_SOURCE
from app.evaluation.metrics.controller import (
    apply_metric_patch,
    get_metric_record,
    list_metric_records,
    load_metric,
    load_metric_detail,
    update_metric_record,
    write_metric_source,
)
from app.evaluation.metrics.controller import (
    create_evaluation_metric as create_evaluation_metric_controller,
)
from app.evaluation.metrics.controller import (
    delete_evaluation_metric as delete_evaluation_metric_controller,
)
from app.evaluation.metrics.schemas import (
    EvaluationMetricCreate,
    EvaluationMetricPatch,
)


@tool(
    description=(
        "获取新评价指标源码模板（DEFAULT_METRIC_SOURCE）。"
        "可先调用本工具拿到模板，再基于模板生成完整可运行的 EvaluationMetric 工作流节点源码；"
        "最后用 create_evaluation_metric(body={source}) 保存。"
    )
)
def get_new_evaluation_metric_template() -> str:
    return DEFAULT_METRIC_SOURCE


@tool(
    description=(
        "创建并保存一个评价指标，返回所创建指标的摘要（含 inputs/outputs）。"
        "入参 body 需提供 source（完整 Python 源码字符串）；若省略或为空则使用内置模板。"
    )
)
def create_evaluation_metric(body: dict[str, Any]) -> dict[str, Any]:
    src = (body.get("source") or "").strip()
    if not src:
        src = DEFAULT_METRIC_SOURCE.strip()
    try:
        create_body = EvaluationMetricCreate(source=src)
        rec = create_evaluation_metric_controller(create_body)
    except ValueError as e:
        raise ValueError(str(e)) from e

    loaded = load_metric(rec.id)
    if loaded is None:
        raise ValueError(f"评价指标 {rec.id} 创建后加载失败")
    return loaded.model_dump()


@tool(description="获取评价指标详情（含完整 source），返回所获取的指标详情")
def get_evaluation_metric_detail(metric_id: str) -> dict[str, Any]:
    detail = load_metric_detail(metric_id)
    if detail is None:
        raise ValueError(f"评价指标 {metric_id} 不存在")
    return detail.model_dump()


@tool(description="获取评价指标列表，返回所获取的指标摘要列表")
def get_evaluation_metric_list() -> list[dict[str, Any]]:
    return [
        x.model_dump() for rec in list_metric_records() if (x := load_metric(rec.id)) is not None
    ]


@tool(description="更新评价指标，返回所更新指标的摘要（含 inputs/outputs）")
def update_evaluation_metric(metric_id: str, body: EvaluationMetricPatch) -> dict[str, Any]:
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec) -> None:
        apply_metric_patch(rec, body)
        if "source" in unset and body.source is not None:
            write_metric_source(rec, body.source)
        rec.updated_at = utc_now_iso()

    rec = update_metric_record(metric_id, _apply)
    if rec is None:
        raise ValueError(f"评价指标 {metric_id} 不存在")
    loaded = load_metric(rec.id)
    if loaded is None:
        raise ValueError(f"评价指标 {metric_id} 不存在")
    return loaded.model_dump()


@tool(description="删除评价指标，返回所删除指标的登记信息")
def delete_evaluation_metric(metric_id: str) -> dict[str, Any]:
    rec = get_metric_record(metric_id)
    if rec is None:
        raise ValueError(f"评价指标 {metric_id} 不存在")
    deleted = delete_evaluation_metric_controller(metric_id)
    if deleted is None:
        raise ValueError(f"评价指标 {metric_id} 不存在")
    return deleted.model_dump()


EVALUATION_METRIC_CHAT_TOOLS = [
    get_new_evaluation_metric_template,
    create_evaluation_metric,
    get_evaluation_metric_detail,
    get_evaluation_metric_list,
    update_evaluation_metric,
    delete_evaluation_metric,
]
