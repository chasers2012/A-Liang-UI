import type { AgentWorkflowDetailPublic, AgentWorkflowSummaryPublic } from '@/models/agent-workflow/dto';
import { apiFetchJson } from './client';

export function listAgentWorkflows(): Promise<AgentWorkflowSummaryPublic[]> {
  return apiFetchJson<AgentWorkflowSummaryPublic[]>('/agent/workflows');
}

export function getAgentWorkflow(id: string): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>(`/agent/workflows/${encodeURIComponent(id)}`);
}

export function createAgentWorkflow(body: unknown): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>('/agent/workflows', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchAgentWorkflow(id: string, body: unknown): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>(`/agent/workflows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAgentWorkflow(id: string): Promise<void> {
  return apiFetchJson<void>(`/agent/workflows/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
