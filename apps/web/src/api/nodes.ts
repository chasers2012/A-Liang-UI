import type { NodeDetailPublic, NodeSummaryPublic } from "@/models/nodes/dto";
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

export function patchNode(id: string, body: unknown): Promise<NodeDetailPublic> {
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

