import { apiFetchJson } from '@/api/client';

export type ToolRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  disabled: boolean;
  updated_at: string | null;
  loaded: boolean;
};

export function listTools(): Promise<ToolRecord[]> {
  return apiFetchJson<ToolRecord[]>('/tools');
}

export function setToolDisabled(id: string, disabled: boolean): Promise<void> {
  return apiFetchJson<void>(`/tools/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ disabled }),
  });
}
