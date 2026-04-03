import type {
  AgentChatRequestPublic,
  AgentChatSessionCreateBody,
  AgentChatSessionDetailPublic,
  AgentChatSessionRenameBody,
  AgentChatSessionSummaryPublic,
  AgentLlmSettingsPublic,
  AgentNodeTypePublic,
  AgentWorkflowDetailPublic,
  AgentWorkflowSummaryPublic,
  DataSourcePublic,
  EvaluationMetricDetailPublic,
  EvaluationMetricSummaryPublic,
  EvaluationProfilePublic,
  DataSetPublic,
  FactorDetailPublic,
  FactorEvaluationRowPublic,
  FactorEvaluationsSummaryPublic,
  FactorSummaryPublic,
  EvaluationNodeTypeCatalogItemPublic,
  SqlTableColumnsRequestBody,
  SqlTableColumnsResponseBody,
  TestResult,
} from "@/models";

/** Base URL for quant-agent FastAPI (no trailing slash). */
export function getQuantAgentApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_QUANT_AGENT_API ?? "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
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
      return j.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: string }).msg)
            : String(d),
        )
        .join("; ");
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
  const hasJsonBody = typeof init?.body === "string" && init.body.length > 0;
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

export function getAgentLlmSettings(): Promise<AgentLlmSettingsPublic> {
  return apiFetchJson<AgentLlmSettingsPublic>("/agent/llm-settings");
}

export function putAgentLlmSettings(
  body: AgentLlmSettingsPublic,
): Promise<AgentLlmSettingsPublic> {
  return apiFetchJson<AgentLlmSettingsPublic>("/agent/llm-settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

type AgentChatSseParsed =
  | { kind: "delta"; text: string }
  | { kind: "done" }
  | { kind: "error"; message: string }
  | { kind: "skip" };

function parseAgentChatSseBlock(block: string): AgentChatSseParsed {
  const dataLines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, "").trim());
  if (dataLines.length === 0) return { kind: "skip" };
  const payload = dataLines.join("\n");
  if (!payload) return { kind: "skip" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { kind: "skip" };
  }
  if (typeof parsed !== "object" || parsed === null) return { kind: "skip" };
  const o = parsed as Record<string, unknown>;
  if (typeof o.error === "string") return { kind: "error", message: o.error };
  if (o.done === true) return { kind: "done" };
  if (typeof o.delta === "string" && o.delta.length > 0) {
    return { kind: "delta", text: o.delta };
  }
  return { kind: "skip" };
}

/**
 * POST ``/agent/chat/stream`` (SSE). Invokes ``onDelta`` for each text chunk; throws ``ApiError`` on HTTP or stream ``error`` events.
 */
export async function postAgentChatStream(
  body: AgentChatRequestPublic,
  options: { onDelta: (text: string) => void },
): Promise<void> {
  const url = `${getQuantAgentApiBase()}/agent/chat/stream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError("响应无正文", res.status || 502);
  }
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const sep = buffer.indexOf("\n\n");
      if (sep === -1) break;
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const ev = parseAgentChatSseBlock(block);
      if (ev.kind === "skip") continue;
      if (ev.kind === "error") throw new ApiError(ev.message, 502);
      if (ev.kind === "done") return;
      options.onDelta(ev.text);
    }
  }
}

export function listAgentChatSessions(): Promise<AgentChatSessionSummaryPublic[]> {
  return apiFetchJson<AgentChatSessionSummaryPublic[]>("/agent/chat/sessions");
}

export function createAgentChatSession(
  body: AgentChatSessionCreateBody,
): Promise<AgentChatSessionDetailPublic> {
  return apiFetchJson<AgentChatSessionDetailPublic>("/agent/chat/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAgentChatSession(
  id: string,
): Promise<AgentChatSessionDetailPublic> {
  return apiFetchJson<AgentChatSessionDetailPublic>(
    `/agent/chat/sessions/${encodeURIComponent(id)}`,
  );
}

export function renameAgentChatSession(
  id: string,
  body: AgentChatSessionRenameBody,
): Promise<AgentChatSessionDetailPublic> {
  return apiFetchJson<AgentChatSessionDetailPublic>(
    `/agent/chat/sessions/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function deleteAgentChatSession(id: string): Promise<void> {
  return apiFetchJson<void>(`/agent/chat/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listAgentWorkflows(): Promise<AgentWorkflowSummaryPublic[]> {
  return apiFetchJson<AgentWorkflowSummaryPublic[]>("/agent/workflows");
}

export function getAgentWorkflow(
  id: string,
): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>(
    `/agent/workflows/${encodeURIComponent(id)}`,
  );
}

export function createAgentWorkflow(
  body: unknown,
): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>("/agent/workflows", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchAgentWorkflow(
  id: string,
  body: unknown,
): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>(
    `/agent/workflows/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteAgentWorkflow(id: string): Promise<void> {
  return apiFetchJson<void>(`/agent/workflows/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listAgentWorkflowNodeTypes(): Promise<AgentNodeTypePublic[]> {
  return apiFetchJson<AgentNodeTypePublic[]>("/agent/workflows/node-types");
}

export function listDatasources(): Promise<DataSourcePublic[]> {
  return apiFetchJson<DataSourcePublic[]>("/datasources");
}

export function getDatasource(id: string): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>(
    `/datasources/${encodeURIComponent(id)}`,
  );
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
  return apiFetchJson<DataSourcePublic>(
    `/datasources/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
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

export function fetchSqlTableColumns(
  body: SqlTableColumnsRequestBody,
): Promise<SqlTableColumnsResponseBody> {
  return apiFetchJson<SqlTableColumnsResponseBody>(
    "/datasources/sql-table-columns",
    {
      method: "POST",
      body: JSON.stringify({
        ...(body.datasource_id ? { datasource_id: body.datasource_id } : {}),
        db_driver: body.db_driver,
        db_host: body.db_host,
        db_port: body.db_port ?? null,
        db_username: body.db_username,
        db_password: body.db_password,
        db_name: body.db_name,
        table: body.table,
      }),
    },
  );
}

export function listFactors(): Promise<FactorSummaryPublic[]> {
  return apiFetchJson<FactorSummaryPublic[]>("/factors");
}

export function getFactor(id: string): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(`/factors/${encodeURIComponent(id)}`);
}

export function getFactorTemplate(): Promise<string> {
  return apiFetchJson<string>(`/factors/template`);
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

export function getFactorEvaluationsSummary(): Promise<FactorEvaluationsSummaryPublic> {
  return apiFetchJson<FactorEvaluationsSummaryPublic>(
    "/factors/evaluations/summary",
  );
}

export function listDataSets(): Promise<DataSetPublic[]> {
  return apiFetchJson<DataSetPublic[]>("/data-sets");
}

export function getDataSet(id: string): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`);
}

export function createDataSet(body: unknown): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>("/data-sets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchDataSet(
  id: string,
  body: unknown,
): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteDataSet(id: string): Promise<void> {
  return apiFetchJson<void>(`/data-sets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function runFactorEvaluation(
  factorId: string,
  options?: {
    dataSetId?: string | null;
    evaluationProfileId?: string | null;
  },
): Promise<FactorEvaluationRowPublic> {
  const init: RequestInit = { method: "POST" };
  if (options !== undefined) {
    init.body = JSON.stringify({
      data_set_id: options.dataSetId ?? null,
      evaluation_profile_id: options.evaluationProfileId ?? null,
    });
  }
  return apiFetchJson<FactorEvaluationRowPublic>(
    `/factors/${encodeURIComponent(factorId)}/evaluations/run`,
    init,
  );
}

export function listEvaluationMetrics(): Promise<
  EvaluationMetricSummaryPublic[]
> {
  return apiFetchJson<EvaluationMetricSummaryPublic[]>("/evaluation-metrics");
}

export function getEvaluationMetric(
  id: string,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>(
    `/evaluation-metrics/${encodeURIComponent(id)}`,
  );
}

export function getEvaluationMetricTemplate(): Promise<string> {
  return apiFetchJson<string>("/evaluation-metrics/template");
}

export function createEvaluationMetric(
  body: unknown,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>("/evaluation-metrics", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvaluationMetric(
  id: string,
  body: unknown,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>(
    `/evaluation-metrics/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteEvaluationMetric(id: string): Promise<void> {
  return apiFetchJson<void>(`/evaluation-metrics/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listEvaluationProfiles(): Promise<EvaluationProfilePublic[]> {
  return apiFetchJson<EvaluationProfilePublic[]>("/evaluation-profiles");
}

export function getEvaluationProfile(
  id: string,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(
    `/evaluation-profiles/${encodeURIComponent(id)}`,
  );
}

export function createEvaluationProfile(
  body: unknown,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>("/evaluation-profiles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvaluationProfile(
  id: string,
  body: unknown,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(
    `/evaluation-profiles/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteEvaluationProfile(id: string): Promise<void> {
  return apiFetchJson<void>(`/evaluation-profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listEvaluationNodeTypes(): Promise<
  EvaluationNodeTypeCatalogItemPublic[]
> {
  return apiFetchJson<EvaluationNodeTypeCatalogItemPublic[]>(
    "/evaluation-profiles/node-types",
  );
}

/** 领域 DTO：也可从 `@/models` 直接引用。 */
export type * from "@/models";
