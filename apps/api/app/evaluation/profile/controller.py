from __future__ import annotations

from workflow.node_loader import WorkflowNodeLoader
from workflow.parser import Parser

from app.evaluation.metrics.controller import list_metric_records, read_metric_source
from app.evaluation.profile.constants import evaluation_workflow_io_spec_dict
from app.evaluation.profile.internal_nodes import get_internal_nodes
from app.evaluation.profile.schemas import EvaluationNodeTypePublic, WorkflowIOSpecPublic


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: str) -> None:
        self.profile_id = profile_id
        super().__init__(profile_id)


class FactorNotFoundError(LookupError):
    def __init__(self, factor_id: str) -> None:
        self.factor_id = factor_id
        super().__init__(factor_id)


def list_evaluation_profile_node_types_public() -> list[EvaluationNodeTypePublic]:
    """Evaluation workflow node types catalog for UI (built-in nodes + metrics nodes)."""
    out: list[EvaluationNodeTypePublic] = []

    # built-in nodes (internal catalog)
    out.extend(get_internal_nodes())

    # metrics nodes (loaded from stored source)
    for metric in list_metric_records():
        source = read_metric_source(metric)
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(source)
        inputs = [Parser.serialize_socket(s) for s in node_cls.inputs]
        outputs = [Parser.serialize_socket(s) for s in node_cls.outputs]

        category = getattr(node_cls, "category", None)
        if isinstance(category, str):
            category = category.strip() or None

        out.append(
            EvaluationNodeTypePublic(
                type=metric.id,
                label=metric.name,
                description=metric.description,
                category=category,
                inputs=inputs,
                outputs=outputs,
            )
        )
    return out


def get_evaluation_profile_workflow_io_spec() -> WorkflowIOSpecPublic:
    return WorkflowIOSpecPublic(**evaluation_workflow_io_spec_dict())
