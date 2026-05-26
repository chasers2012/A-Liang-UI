const DEFAULT_DEV_API = 'http://127.0.0.1:8000/api';
const DEFAULT_SAME_ORIGIN_API = '/api';

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/$/, '');
}

function publicApiBaseFromEnv(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_QUANT_AGENT_API?.trim() || process.env.QUANT_AGENT_API?.trim();
  return raw ? normalizeApiBase(raw) : undefined;
}

/** Resolve API base on the server (local dev / SSR). */
export function resolveQuantAgentApiBase(): string {
  return publicApiBaseFromEnv() ?? DEFAULT_DEV_API;
}

/** Base URL for quant-agent FastAPI (no trailing slash). */
export function getQuantAgentApiBase(): string {
  if (typeof window !== 'undefined') {
    return publicApiBaseFromEnv() ?? DEFAULT_SAME_ORIGIN_API;
  }
  return resolveQuantAgentApiBase();
}
