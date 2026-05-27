const DEFAULT_DEV_API = 'http://127.0.0.1:8000/api';
const DEFAULT_SAME_ORIGIN_API = '/api';

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/$/, '');
}

function publicApiBaseFromEnv(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_A_LIANG_UI_API?.trim() || process.env.A_LIANG_UI_API?.trim();
  return raw ? normalizeApiBase(raw) : undefined;
}

/** Resolve API base on the server (local dev / SSR). */
export function resolveALiangUiApiBase(): string {
  return publicApiBaseFromEnv() ?? DEFAULT_DEV_API;
}

/** Base URL for A-Liang-UI FastAPI (no trailing slash). */
export function getALiangUiApiBase(): string {
  if (typeof window !== 'undefined') {
    return publicApiBaseFromEnv() ?? DEFAULT_SAME_ORIGIN_API;
  }
  return resolveALiangUiApiBase();
}
