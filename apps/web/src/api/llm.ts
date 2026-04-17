import type { LlmSettingsPublic } from '@/models/agent-llm/dto';
import { apiFetchJson } from './client';

export function getLlmSettings(): Promise<LlmSettingsPublic> {
  return apiFetchJson<LlmSettingsPublic>('/chat/llm-settings');
}

export function putLlmSettings(body: LlmSettingsPublic): Promise<LlmSettingsPublic> {
  return apiFetchJson<LlmSettingsPublic>('/chat/llm-settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
