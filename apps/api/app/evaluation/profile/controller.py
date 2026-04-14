from __future__ import annotations

from app.evaluation.profile.constants import evaluation_workflow_io_spec_dict
from app.evaluation.profile.schemas import EvaluationNodeTypePublic, WorkflowIOSpecPublic
from app.nodes.controller import list_nodes_by_domain


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

    # domain nodes (user nodes + plugin nodes)
    for node in list_nodes_by_domain("evaluation-profile"):
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
    return out


def get_evaluation_profile_workflow_io_spec() -> WorkflowIOSpecPublic:
    return WorkflowIOSpecPublic(**evaluation_workflow_io_spec_dict())
