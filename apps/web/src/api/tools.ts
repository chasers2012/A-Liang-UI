import { apiFetchJson } from '@/api/client';

export type ToolRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  authorization: 'disabled' | 'need authorize' | 'allowed';
  updated_at: string | null;
  loaded: boolean;
};

export function listTools(): Promise<ToolRecord[]> {
  return apiFetchJson<ToolRecord[]>('/tools');
}

export function setToolAuthorization(id: string, authorization: ToolRecord['authorization']): Promise<void> {
  return apiFetchJson<void>(`/tools/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ authorization }),
  });
}
