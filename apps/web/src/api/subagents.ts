import { apiFetchJson } from '@/api/client';

export type SubagentToolRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  loaded: boolean;
};

export type SubagentToolConfigRecord = {
  subagent_id: string;
  title: string;
  description: string;
  default_tool_ids: string[];
  tool_ids: string[];
};

export type SubagentToolConfigListResponse = {
  subagents: SubagentToolConfigRecord[];
  tools: SubagentToolRecord[];
};

export function listSubagentToolConfigs(): Promise<SubagentToolConfigListResponse> {
  return apiFetchJson<SubagentToolConfigListResponse>('/agents/subagents/tools');
}

export function updateSubagentToolConfig(subagentId: string, toolIds: string[]): Promise<SubagentToolConfigRecord> {
  return apiFetchJson<SubagentToolConfigRecord>(`/agents/subagents/${encodeURIComponent(subagentId)}/tools`, {
    method: 'PUT',
    body: JSON.stringify({ tool_ids: toolIds }),
  });
}
