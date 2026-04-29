from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.nodes.schemas import (
    WorkflowDomainNodeValidationPublic,
    WorkflowDomainNodeVisibilityPatch,
    WorkflowDomainNodeVisibilityPublic,
)

from . import controller

router = APIRouter(prefix="/node-visibility", tags=["nodes"])


@router.get("", response_model=list[WorkflowDomainNodeVisibilityPublic])
def list_domain_nodes() -> list[WorkflowDomainNodeVisibilityPublic]:
    data = controller.list_domain_node_visibility_configs()
    return [
        WorkflowDomainNodeVisibilityPublic(domain=domain, hidden_node_ids=hidden_node_ids)
        for domain, hidden_node_ids in sorted(data.items(), key=lambda item: item[0])
    ]


@router.get("/{domain}", response_model=WorkflowDomainNodeVisibilityPublic)
def get_domain_nodes(domain: str) -> WorkflowDomainNodeVisibilityPublic:
    hidden_node_ids = controller.get_domain_node_visibility_config(domain)
    if hidden_node_ids is None:
        raise HTTPException(status_code=404, detail="领域未配置")
    return WorkflowDomainNodeVisibilityPublic(
        domain=domain.strip(), hidden_node_ids=hidden_node_ids
    )


@router.put("/{domain}", response_model=WorkflowDomainNodeVisibilityPublic)
def put_domain_nodes(
    domain: str, body: WorkflowDomainNodeVisibilityPatch
) -> WorkflowDomainNodeVisibilityPublic:
    request_domain = body.domain.strip()
    path_domain = domain.strip()
    if request_domain != path_domain:
        raise HTTPException(status_code=400, detail="path domain 与 body.domain 不一致")
    hidden_node_ids = controller.upsert_domain_node_visibility_config(
        path_domain, body.hidden_node_ids
    )
    return WorkflowDomainNodeVisibilityPublic(domain=path_domain, hidden_node_ids=hidden_node_ids)


@router.get("/{domain}/nodes/{node_id}/allowed", response_model=WorkflowDomainNodeValidationPublic)
def is_domain_node_allowed(domain: str, node_id: str) -> WorkflowDomainNodeValidationPublic:
    return WorkflowDomainNodeValidationPublic(
        domain=domain.strip(),
        node_id=node_id,
        allowed=controller.is_node_visible_in_domain(domain, node_id),
    )
