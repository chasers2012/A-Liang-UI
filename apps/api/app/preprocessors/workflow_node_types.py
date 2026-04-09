from __future__ import annotations

import json
from typing import Any

from factor import DataPreprocessorBase
from workflow import Node, Socket, StringNodeParam, WorkflowNodeLoader
from workflow.parser import Parser

from app.evaluation.profile.schemas import EvaluationNodeTypePublic
from app.preprocessors.controller import list_preprocessor_records, resolve_preprocessor_class
from app.startup_jobs import register_startup_job

_RAW_FRAMES_VALUE_TYPE = "raw_frames"
_REGISTERED_PREPROCESSOR_IDS: set[str] = set()


def _parse_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict) or isinstance(parsed, list):
        raise ValueError("config_json 必须是 JSON object（形如 { ... }）")
    return parsed


def _parse_datasource_ids_csv(text: str) -> list[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    parts = raw.split(",")
    return [p.strip() for p in parts if p.strip()]


def _make_preprocessor_apply_node_cls(
    *, preprocessor_id: str, preprocessor: DataPreprocessorBase
) -> type[Node]:
    """Create a wrapper Node class for one concrete preprocessor id."""

    class PreprocessorApplyNode(Node):
        def execute(  # type: ignore[override]
            self,
            frames: dict[str, Any],
            config_json: str = "",
            datasource_ids_csv: str = "",
            **kwargs: Any,
        ) -> dict[str, Any]:
            _ = kwargs

            cfg = _parse_json_object(config_json)
            ds_ids = _parse_datasource_ids_csv(datasource_ids_csv)

            if ds_ids:
                scoped_in = {k: frames[k] for k in ds_ids if k in frames}
                scoped_out = preprocessor.transform(scoped_in, config=cfg)
                if not isinstance(scoped_out, dict):
                    raise ValueError("预处理器 transform 必须返回 dict[str, DataFrame]")
                out = dict(frames)
                out.update(scoped_out)
                return out

            out_new = preprocessor.transform(frames, config=cfg)
            if not isinstance(out_new, dict):
                raise ValueError("预处理器 transform 必须返回 dict[str, DataFrame]")
            return out_new

    PreprocessorApplyNode.__name__ = f"PreprocessorApply_{preprocessor_id.replace('-', '_')}"
    return PreprocessorApplyNode


def _system_node_types() -> list[EvaluationNodeTypePublic]:
    # Imported lazily to avoid import-time side-effects.
    from factor.preprocessing_workflow_nodes import CollectFrames, DataSetFramesInput

    def _to_type(item) -> EvaluationNodeTypePublic:
        return EvaluationNodeTypePublic(
            type=item.type,
            label=item.label,
            description=item.description,
            category=getattr(item, "category", None),
            inputs=[Parser.serialize_socket(s) for s in item.inputs],
            outputs=[Parser.serialize_socket(s) for s in item.outputs],
        )

    return [_to_type(DataSetFramesInput), _to_type(CollectFrames)]


def ensure_preprocessor_workflow_nodes_registered() -> None:
    """Ensure wrapper Node classes are registered for all existing preprocessors.

    This is needed because preprocessors can be created after app startup.
    """
    loader = WorkflowNodeLoader.instance()
    for rec in list_preprocessor_records():
        if rec.id in _REGISTERED_PREPROCESSOR_IDS:
            continue
        cls = resolve_preprocessor_class(rec.id)
        if cls is None:
            continue
        try:
            inst = cls()
        except Exception:
            continue
        node_cls = _make_preprocessor_apply_node_cls(preprocessor_id=rec.id, preprocessor=inst)
        loader.register_node(rec.id, node_cls)
        _REGISTERED_PREPROCESSOR_IDS.add(rec.id)


def list_preprocessor_node_types_public() -> list[EvaluationNodeTypePublic]:
    """Preprocessing workflow node catalog for UI (DAG canvas)."""
    # Lazy registration so newly-created preprocessors can be executed without
    # restarting the service.
    ensure_preprocessor_workflow_nodes_registered()

    out: list[EvaluationNodeTypePublic] = []
    out.extend(_system_node_types())

    # Shared socket/param specs for each concrete preprocessor-node type.
    frames_in = Socket(
        "frames",
        required=True,
        value_type=_RAW_FRAMES_VALUE_TYPE,
        label="输入 frames",
        description="上游节点输出（或由后端上下文注入）",
    )
    frames_out = Socket(
        "frames",
        value_type=_RAW_FRAMES_VALUE_TYPE,
        label="输出 frames",
        description="预处理后的 frames 映射",
    )
    config_param = StringNodeParam(
        "config_json",
        required=False,
        default="",
        label="config_json（JSON object）",
        description="留空表示 {}；必须是 JSON object（{ ... }）",
    )
    ds_ids_param = StringNodeParam(
        "datasource_ids_csv",
        required=False,
        default="",
        label="datasource_ids_csv（逗号分隔）",
        description="留空表示对全部 frames 生效；例如 ds_1,ds_2",
    )

    for rec in list_preprocessor_records():
        label = (rec.name or rec.id).strip() if hasattr(rec, "name") else rec.id
        description = (rec.description or "").strip()
        out.append(
            EvaluationNodeTypePublic(
                type=rec.id,
                label=label,
                description=description,
                category="data_set_preprocess",
                inputs=[
                    Parser.serialize_socket(frames_in),
                    Parser.serialize_socket(config_param),
                    Parser.serialize_socket(ds_ids_param),
                ],
                outputs=[Parser.serialize_socket(frames_out)],
            )
        )

    return out


@register_startup_job
def register_preprocessor_workflow_nodes() -> None:
    """Register wrapper Node classes under type keys = preprocessor.id."""
    ensure_preprocessor_workflow_nodes_registered()
