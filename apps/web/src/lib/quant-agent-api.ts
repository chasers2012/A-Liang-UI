/** Base URL for quant-agent FastAPI (no trailing slash). */
export function getQuantAgentApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_QUANT_AGENT_API ?? "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
}

export type DataSourceType = "sql" | "csv";

export interface SqlPublic {
  db_driver: string;
  db_host: string;
  db_port: number | null;
  db_username: string;
  db_name: string;
  has_password: boolean;
  has_legacy_engine_url: boolean;
  table: string;
  date_column: string;
  asset_column: string;
  column_map: Record<string, string>;
}

export interface CsvPublic {
  path: string;
  date_column: string;
  asset_column: string;
  read_csv_kwargs: Record<string, unknown>;
}

export interface DataSourcePublic {
  id: string;
  name: string;
  type: DataSourceType;
  enabled: boolean;
  is_default: boolean;
  sql: SqlPublic | null;
  csv: CsvPublic | null;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function parseDetail(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail.map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: string }).msg) : String(d))).join("; ");
    }
  } catch {
    /* ignore */
  }
  return text || "请求失败";
}

export async function apiFetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${getQuantAgentApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const hasJsonBody =
    typeof init?.body === "string" && init.body.length > 0;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
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

export function listDatasources(): Promise<DataSourcePublic[]> {
  return apiFetchJson<DataSourcePublic[]>("/datasources");
}

export function createDatasource(body: unknown): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>("/datasources", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchDatasource(
  id: string,
  body: unknown,
): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>(`/datasources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteDatasource(id: string): Promise<void> {
  return apiFetchJson<void>(`/datasources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function testDatasource(id: string): Promise<TestResult> {
  return apiFetchJson<TestResult>(
    `/datasources/${encodeURIComponent(id)}/test`,
    { method: "POST" },
  );
}

export interface FactorSummaryPublic {
  id: string;
  name: string;
  group: string;
  group_label: string;
  description: string;
  max_window: number;
  dependencies: string[];
  source_path: string;
  created_at: string;
  updated_at: string;
}

export interface FactorDetailPublic extends FactorSummaryPublic {
  source: string;
}

export function listFactors(): Promise<FactorSummaryPublic[]> {
  return apiFetchJson<FactorSummaryPublic[]>("/factors");
}

export function getFactor(id: string): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(
    `/factors/${encodeURIComponent(id)}`,
  );
}

export function createFactor(body: unknown): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>("/factors", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchFactor(
  id: string,
  body: unknown,
): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(
    `/factors/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteFactor(id: string): Promise<void> {
  return apiFetchJson<void>(`/factors/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
