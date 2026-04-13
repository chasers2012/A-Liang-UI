from __future__ import annotations

import json
from typing import Any

from workflow import Node, WorkflowNodeLoader
from workflow.parser import Parser

from app.data_set.constants import preprocessing_workflow_io_spec_dict
from app.evaluation.profile.schemas import EvaluationNodeTypePublic, WorkflowIOSpecPublic
from app.nodes.controller import list_nodes_by_domain
from app.preprocessors.controller import list_preprocessor_records, resolve_preprocessor_class
from app.startup_jobs import register_startup_job
from app.visibility.controller import ensure_domain_node_visibility_config

_REGISTERED_PREPROCESSOR_IDS: set[str] = set()
_PREPROCESSING_WORKFLOW_IO_SPEC = WorkflowIOSpecPublic(**preprocessing_workflow_io_spec_dict())
_PREPROCESSING_DOMAIN = "preprocessors"

ensure_domain_node_visibility_config(_PREPROCESSING_DOMAIN)


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
    *, preprocessor_id: str, preprocessor_cls: type
) -> type[Node]:
    """Create an executable wrapper for one concrete preprocessor id.

    Input/output socket specs are inherited from `preprocessor_cls` so the
    runtime and node-catalog both follow @workflow_node(...) definitions.
    """

    class PreprocessorApplyNode(preprocessor_cls, Node):  # type: ignore[misc]
        def execute(  # type: ignore[override]
            self,
            **kwargs: Any,
        ) -> dict[str, Any]:
            frames = kwargs.get("frames")
            if not isinstance(frames, dict):
                raise ValueError("预处理器节点缺少 frames 输入")
            config_json = str(kwargs.get("config_json", "") or "")
            datasource_ids_csv = str(kwargs.get("datasource_ids_csv", "") or "")

            cfg = _parse_json_object(config_json)
            ds_ids = _parse_datasource_ids_csv(datasource_ids_csv)

            if ds_ids:
                scoped_in = {k: frames[k] for k in ds_ids if k in frames}
                scoped_out = self.transform(frames=scoped_in, config=cfg)
                if not isinstance(scoped_out, dict):
                    raise ValueError("预处理器 transform 必须返回 dict[str, DataFrame]")
                out = dict(frames)
                out.update(scoped_out)
                return out

            out_new = self.transform(frames=frames, config=cfg)
            if not isinstance(out_new, dict):
                raise ValueError("预处理器 transform 必须返回 dict[str, DataFrame]")
            return out_new

    PreprocessorApplyNode.__name__ = f"PreprocessorApply_{preprocessor_id.replace('-', '_')}"
    return PreprocessorApplyNode


def ensure_preprocessor_workflow_nodes_registered() -> None:
    """Ensure wrapper Node classes are registered for all existing preprocessors.

    This is needed because preprocessors can be created after app startup.
    """
    loader = WorkflowNodeLoader.instance()
    for rec in list_preprocessor_records():
        if rec.id in _REGISTERED_PREPROCESSOR_IDS:
            continue
        preprocessor_cls = resolve_preprocessor_class(rec.id)
        if preprocessor_cls is None:
            continue
        node_cls = _make_preprocessor_apply_node_cls(
            preprocessor_id=rec.id, preprocessor_cls=preprocessor_cls
        )
        loader.register_node(rec.id, node_cls)
        _REGISTERED_PREPROCESSOR_IDS.add(rec.id)


def list_preprocessor_node_types_public() -> list[EvaluationNodeTypePublic]:
    """Preprocessing workflow node catalog for UI (DAG canvas)."""
    # Lazy registration so newly-created preprocessors can be executed without
    # restarting the service.
    ensure_preprocessor_workflow_nodes_registered()

    out: list[EvaluationNodeTypePublic] = []
    seen_type_keys: set[str] = set()

    loader = WorkflowNodeLoader.instance()

    for rec in list_preprocessor_records():
        try:
            node_obj = loader.resolve(rec.id)()  # type: ignore[call-arg]
        except Exception:
            continue

        out.append(
            EvaluationNodeTypePublic(
                type=rec.id,
                label=rec.name,
                description=node_obj.description,
                category=node_obj.category,
                inputs=[Parser.serialize_socket(s) for s in node_obj.inputs],
                outputs=[Parser.serialize_socket(s) for s in node_obj.outputs],
            )
        )
        seen_type_keys.add(rec.id)

    # Include generic workflow nodes (user + plugin) filtered by preprocessing domain.
    for node in list_nodes_by_domain(_PREPROCESSING_DOMAIN):
        if node.id in seen_type_keys:
            continue
        out.append(
            EvaluationNodeTypePublic(
                type=node.id,
                label=node.name,
                description=node.description,
                category=node.category,
                inputs=node.inputs,
                outputs=node.outputs,
            )
        )
        seen_type_keys.add(node.id)

    return out


def get_preprocessor_workflow_io_spec() -> WorkflowIOSpecPublic:
    return _PREPROCESSING_WORKFLOW_IO_SPEC


@register_startup_job
def register_preprocessor_workflow_nodes() -> None:
    """Register wrapper Node classes under type keys = preprocessor.id."""
    ensure_preprocessor_workflow_nodes_registered()
