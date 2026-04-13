from __future__ import annotations

from app.visibility.registry import WorkflowDomainNodesRegistry


def list_domain_node_visibility_configs() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for domain in WorkflowDomainNodesRegistry.list_domains():
        hidden_ids = WorkflowDomainNodesRegistry.get_hidden_node_ids(domain)
        out[domain] = sorted(hidden_ids or [])
    return out


def get_domain_node_visibility_config(domain: str) -> list[str] | None:
    hidden_ids = WorkflowDomainNodesRegistry.get_hidden_node_ids(domain)
    if hidden_ids is None:
        return None
    return sorted(hidden_ids)


def ensure_domain_node_visibility_config(domain: str) -> list[str]:
    existing = get_domain_node_visibility_config(domain)
    if existing is not None:
        return existing
    WorkflowDomainNodesRegistry.set_hidden_node_ids(domain, [])
    return []


def upsert_domain_node_visibility_config(domain: str, hidden_node_ids: list[str]) -> list[str]:
    WorkflowDomainNodesRegistry.set_hidden_node_ids(domain, hidden_node_ids)
    hidden_ids = WorkflowDomainNodesRegistry.get_hidden_node_ids(domain)
    return sorted(hidden_ids or [])


def delete_domain_node_visibility_config(domain: str) -> bool:
    hidden_before = WorkflowDomainNodesRegistry.get_hidden_node_ids(domain)
    if hidden_before is None:
        return False
    WorkflowDomainNodesRegistry.delete_domain_visibility(domain)
    return True


def is_node_visible_in_domain(domain: str, node_id: str) -> bool:
    return WorkflowDomainNodesRegistry.is_node_visible(domain, node_id)
