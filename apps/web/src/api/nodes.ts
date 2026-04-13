import type {
  NodeDetailPublic,
  NodeSummaryPublic,
  WorkflowDomainNodeVisibilityPublic,
} from "@/models/nodes/dto";
import { apiFetchJson } from "./client";

export function listNodes(): Promise<NodeSummaryPublic[]> {
  return apiFetchJson<NodeSummaryPublic[]>("/nodes");
}

export function getNode(id: string): Promise<NodeDetailPublic> {
  return apiFetchJson<NodeDetailPublic>(`/nodes/${encodeURIComponent(id)}`);
}

export function getNodeTemplate(): Promise<string> {
  return apiFetchJson<string>("/nodes/template");
}

export function createNode(body: unknown): Promise<NodeDetailPublic> {
  return apiFetchJson<NodeDetailPublic>("/nodes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchNode(
  id: string,
  body: unknown,
): Promise<NodeDetailPublic> {
  return apiFetchJson<NodeDetailPublic>(`/nodes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteNode(id: string): Promise<void> {
  return apiFetchJson<void>(`/nodes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listNodeVisibilityConfigs(): Promise<WorkflowDomainNodeVisibilityPublic[]> {
  return apiFetchJson<WorkflowDomainNodeVisibilityPublic[]>(
    "/nodes/node-visibility",
  );
}

export function putNodeVisibilityConfig(
  domain: string,
  hidden_node_ids: string[],
): Promise<WorkflowDomainNodeVisibilityPublic> {
  const safeDomain = domain.trim();
  return apiFetchJson<WorkflowDomainNodeVisibilityPublic>(
    `/nodes/node-visibility/${encodeURIComponent(safeDomain)}`,
    {
      method: "PUT",
      body: JSON.stringify({ domain: safeDomain, hidden_node_ids }),
    },
  );
}
