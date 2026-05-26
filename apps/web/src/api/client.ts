import { getQuantAgentApiBase } from '@/lib/quant-agent-api-base';

export { getQuantAgentApiBase };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function parseDetail(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === 'string') return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: string }).msg) : String(d)))
        .join('; ');
    }
  } catch {
    /* ignore */
  }
  return text || '请求失败';
}

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getQuantAgentApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const hasJsonBody = typeof init?.body === 'string' && init.body.length > 0;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
