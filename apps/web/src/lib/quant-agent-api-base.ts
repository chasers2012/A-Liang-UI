const DEFAULT_DEV_API = 'http://127.0.0.1:8000/api';
const DEFAULT_SAME_ORIGIN_API = '/api';

declare global {
  interface Window {
    __QUANT_AGENT_API_BASE__?: string;
  }
}

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/$/, '');
}

/** Resolve API base on the server (local dev / SSR). */
export function resolveQuantAgentApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_QUANT_AGENT_API?.trim() || process.env.QUANT_AGENT_API?.trim() || DEFAULT_DEV_API;
  return normalizeApiBase(raw);
}

/** Base URL for quant-agent FastAPI (no trailing slash). */
export function getQuantAgentApiBase(): string {
  if (typeof window !== 'undefined') {
    const injected = window.__QUANT_AGENT_API_BASE__;
    if (injected !== undefined && injected !== '') {
      return normalizeApiBase(injected);
    }
    return DEFAULT_SAME_ORIGIN_API;
  }
  return resolveQuantAgentApiBase();
}
